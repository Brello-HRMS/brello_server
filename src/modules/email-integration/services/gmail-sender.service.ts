import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

import { EmailIntegrationRepository } from '../repositories/email-integration.repository';
import { EncryptionService } from '../../../common/services/encryption.service';
import { GoogleOAuthService } from './google-oauth.service';
import { EmailIntegration } from '../entities/email-integration.entity';

export interface GmailMessage {
  to: string;
  subject: string;
  html: string;
  attachments?: { filename: string; content?: Buffer | string; path?: string }[];
}

/**
 * GmailSenderService
 *
 * Sends outbound mail through an organization's connected Gmail account using
 * the Gmail REST API (users.messages.send).
 *
 * IMPORTANT: we deliberately use the Gmail API rather than Gmail SMTP. The
 * connected accounts grant the send-only scope `gmail.send`, which the Gmail
 * API accepts — but Gmail's SMTP server (XOAUTH2) requires the far broader
 * `https://mail.google.com/` scope and rejects `gmail.send` with
 * "535-5.7.8 Username and Password not accepted". Keeping to the API lets us
 * stay send-only.
 *
 * Exported by EmailIntegrationModule so the notification pipeline can route an
 * organization's mail through its own Gmail when one is active.
 */
@Injectable()
export class GmailSenderService {
  private readonly logger = new Logger(GmailSenderService.name);
  private static readonly SEND_ENDPOINT =
    'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';

  constructor(
    private readonly repository: EmailIntegrationRepository,
    private readonly encryption: EncryptionService,
    private readonly googleOAuth: GoogleOAuthService,
  ) {}

  /**
   * Sends a message through the organization's ACTIVE Gmail integration.
   * Returns `true` if it was sent via Gmail, `false` if the org has no active
   * integration (caller should fall back to the default provider).
   */
  async sendForOrganization(
    organizationId: string,
    message: GmailMessage,
  ): Promise<boolean> {
    const integration = await this.repository.findActiveForOrg(organizationId);
    if (!integration) {
      return false;
    }

    await this.sendViaIntegration(integration, message);
    return true;
  }

  /**
   * Sends a message through a SPECIFIC integration (used by the "test" action).
   * Throws on failure so the caller can surface a meaningful error.
   */
  async sendViaIntegration(
    integration: EmailIntegration,
    message: GmailMessage,
  ): Promise<void> {
    const from = integration.display_name
      ? `${integration.display_name} <${integration.email}>`
      : integration.email;

    try {
      const refreshToken = this.encryption.decrypt(
        integration.refresh_token_encrypted,
      );
      const accessToken = await this.googleOAuth.getAccessToken(refreshToken);
      const raw = await this.buildRawMessage({ from, ...message });

      const response = await fetch(GmailSenderService.SEND_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ raw }),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Gmail API responded ${response.status}: ${body}`);
      }

      await this.repository.update(integration.id, {
        last_used_at: new Date(),
      });
      this.logger.log(
        `Email sent via Gmail API from ${integration.email} (org ${integration.organization_id})`,
      );
    } catch (error) {
      this.logger.error(
        `Gmail send failed for ${integration.email}: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  /**
   * Builds a base64url-encoded RFC 2822 message. We use nodemailer's stream
   * transport purely as a MIME builder (it composes the message but does not
   * send it), then hand the raw bytes to the Gmail API.
   */
  private async buildRawMessage(msg: {
    from: string;
    to: string;
    subject: string;
    html: string;
    attachments?: any[];
  }): Promise<string> {
    const builder = nodemailer.createTransport({
      streamTransport: true,
      buffer: true,
      newline: 'unix',
    });

    const info = await builder.sendMail({
      from: msg.from,
      to: msg.to,
      subject: msg.subject,
      html: msg.html,
      attachments: msg.attachments,
    });

    const message = (info as unknown as { message: Buffer }).message;
    return message.toString('base64url');
  }
}
