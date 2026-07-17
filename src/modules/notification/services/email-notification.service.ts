import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { render } from '@react-email/render';
import * as nodemailer from 'nodemailer';
import * as React from 'react';
import { Resend } from 'resend';

import { SendNotificationDto } from '../dto/send-notification.dto';
import { OtpEmail } from '../templates/otp-email';
import { TrialReminderEmail } from '../templates/trial-reminder';
import { GmailSenderService } from '../../email-integration/services/gmail-sender.service';

@Injectable()
export class EmailNotificationService {
  private readonly logger = new Logger(EmailNotificationService.name);
  private readonly provider: 'resend' | 'smtp' | 'none';
  private readonly fromAddress: string;
  private readonly resend: Resend | null = null;
  private readonly smtp: nodemailer.Transporter | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly gmailSender: GmailSenderService,
  ) {
    const configured = this.configService.get<string>('email.provider', 'resend');

    if (configured === 'smtp') {
      const host = this.configService.get<string>('smtp.host');
      const user = this.configService.get<string>('smtp.user');
      if (host && user) {
        this.smtp = nodemailer.createTransport({
          host,
          port: this.configService.get<number>('smtp.port', 587),
          secure: this.configService.get<boolean>('smtp.secure', false),
          auth: {
            user,
            pass: this.configService.get<string>('smtp.password'),
          },
        });
        this.fromAddress = this.configService.get<string>('smtp.from') || `Brello <${user}>`;
        this.provider = 'smtp';
        this.logger.log('Email provider: SMTP');
      } else {
        this.logger.warn('email.provider=smtp but smtp.host/smtp.user not set — email disabled');
        this.provider = 'none';
        this.fromAddress = '';
      }
    } else {
      const apiKey = this.configService.get<string>('resend.api_key');
      this.fromAddress =
        this.configService.get<string>('resend.from') || 'Brello <noreply@brello.co.in>';
      if (apiKey) {
        this.resend = new Resend(apiKey);
        this.provider = 'resend';
        this.logger.log('Email provider: Resend');
      } else {
        this.logger.warn('email.provider=resend but resend.api_key not set — email disabled');
        this.provider = 'none';
      }
    }
  }

  async send(dto: SendNotificationDto): Promise<void> {
    const to = dto.target_email;
    if (!to) {
      this.logger.error('Cannot send email: missing target_email');
      return;
    }

    const html = await this.renderTemplate(dto);

    // Per-organization Gmail integration takes precedence: if the org has an
    // active connected account, send from it. Falls through to the default
    // provider when there's no active integration.
    if (dto.organization_id) {
      try {
        const sentViaGmail = await this.gmailSender.sendForOrganization(
          dto.organization_id,
          { to, subject: dto.title, html },
        );
        if (sentViaGmail) {
          this.logger.log(`Email sent to ${to} via org Gmail: "${dto.title}"`);
          return;
        }
      } catch (error) {
        // A Gmail failure should not silently drop the mail — log and fall back
        // to the default provider (if any) so delivery still has a chance.
        this.logger.error(
          `Org Gmail send failed for ${to}, falling back to default provider: ${
            (error as Error).message
          }`,
        );
      }
    }

    if (this.provider === 'none') {
      this.logger.warn('No email provider configured — skipping email delivery');
      return;
    }

    try {
      if (this.provider === 'smtp') {
        await this.smtp!.sendMail({ from: this.fromAddress, to, subject: dto.title, html });
      } else {
        const { error } = await this.resend!.emails.send({
          from: this.fromAddress,
          to,
          subject: dto.title,
          html,
        });
        if (error) throw new Error(error.message);
      }
      this.logger.log(`Email sent to ${to} via ${this.provider}: "${dto.title}"`);
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}: ${error.message}`, error.stack);
      throw error; // re-throw so BullMQ worker triggers retry
    }
  }

  private async renderTemplate(dto: SendNotificationDto): Promise<string> {
    const templateType = dto.metadata?.template as string | undefined;

    if (templateType === 'otp') {
      const element = React.createElement(OtpEmail, {
        otp: dto.metadata?.otp as string,
        purpose: (dto.metadata?.purpose as any) ?? 'login',
        expiresInMinutes: (dto.metadata?.expiresInMinutes as number) ?? 10,
      });
      return render(element);
    }

    if (templateType === 'trial-reminder') {
      const element = React.createElement(TrialReminderEmail, {
        organizationName: (dto.metadata?.organizationName as string) ?? 'Your organization',
        daysRemaining: (dto.metadata?.daysRemaining as number) ?? 3,
        trialEndDate: (dto.metadata?.trialEndDate as string) ?? '',
        upgradeUrl: dto.metadata?.upgradeUrl as string | undefined,
      });
      return render(element);
    }

    // Generic fallback — plain message wrapped in minimal HTML
    return `<div style="font-family: sans-serif; padding: 32px"><p>${dto.message}</p></div>`;
  }
}
