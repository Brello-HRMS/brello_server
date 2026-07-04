import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { render } from '@react-email/render';
import * as React from 'react';
import { Resend } from 'resend';

import { SendNotificationDto } from '../dto/send-notification.dto';
import { OtpEmail } from '../templates/otp-email';
import { TrialReminderEmail } from '../templates/trial-reminder';

@Injectable()
export class EmailNotificationService {
  private readonly logger = new Logger(EmailNotificationService.name);
  private readonly resend: Resend;
  private readonly fromAddress: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('resend.api_key');
    this.fromAddress =
      this.configService.get<string>('resend.from') || 'Brello <noreply@brello.co.in>';
    this.resend = new Resend(apiKey);
  }

  async send(dto: SendNotificationDto): Promise<void> {
    const to = dto.target_email;

    if (!to) {
      this.logger.error('Cannot send email: missing target_email');
      return;
    }

    try {
      const html = await this.renderTemplate(dto);

      const { error } = await this.resend.emails.send({
        from: this.fromAddress,
        to,
        subject: dto.title,
        html,
      });

      if (error) {
        throw new Error(error.message);
      }

      this.logger.log(`Email sent to ${to}: "${dto.title}"`);
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
