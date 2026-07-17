import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { EmailIntegrationRepository } from '../repositories/email-integration.repository';
import { EncryptionService } from '../../../common/services/encryption.service';
import { GoogleOAuthService } from './google-oauth.service';
import { GmailSenderService } from './gmail-sender.service';
import { EmailIntegration } from '../entities/email-integration.entity';
import { EmailIntegrationResponseDto } from '../dto/email-integration-response.dto';
import { TestEmailDto } from '../dto/test-email.dto';
import { EmailProvider } from '../enums/email-provider.enum';
import { Status } from '../../../common/enums';
import { LoggedInUser } from '../../auth/interfaces/logged-in-user.interface';
import {
  GoogleTokenResult,
  OAuthStatePayload,
} from '../interfaces/oauth.interface';

@Injectable()
export class EmailIntegrationService {
  private readonly logger = new Logger(EmailIntegrationService.name);
  private readonly frontendRedirectUrl: string;

  constructor(
    private readonly repository: EmailIntegrationRepository,
    private readonly encryption: EncryptionService,
    private readonly googleOAuth: GoogleOAuthService,
    private readonly gmailSender: GmailSenderService,
    private readonly configService: ConfigService,
  ) {
    this.frontendRedirectUrl =
      this.configService.get<string>('integration.frontendRedirectUrl') ??
      'http://localhost:5173/integration/email';
  }

  /** Lists the organization's connected accounts (secrets stripped). */
  async list(user: LoggedInUser): Promise<EmailIntegrationResponseDto[]> {
    const integrations = await this.repository.findAllForOrg(
      user.organizationId,
    );
    return integrations.map(EmailIntegrationResponseDto.fromEntity);
  }

  /** Builds the Google consent URL, binding this org/user into a signed state. */
  getGoogleAuthUrl(user: LoggedInUser): { url: string } {
    const state = this.googleOAuth.buildState({
      organizationId: user.organizationId,
      enterpriseId: user.enterpriseId,
      userId: user.userId,
    });
    return { url: this.googleOAuth.generateAuthUrl(state) };
  }

  /**
   * Handles the Google OAuth redirect. Runs UNAUTHENTICATED (browser redirect),
   * so all context comes from the signed `state`. Always resolves to a frontend
   * URL to redirect the browser to — success or failure is passed as a query
   * param so the SPA can show a toast.
   */
  async handleGoogleCallback(
    code: string | undefined,
    state: string | undefined,
    oauthError: string | undefined,
  ): Promise<string> {
    if (oauthError) {
      return this.redirectUrl('error', { reason: oauthError });
    }
    if (!code || !state) {
      return this.redirectUrl('error', { reason: 'missing_code_or_state' });
    }

    try {
      const decodedState = this.googleOAuth.verifyState(state);
      const tokens = await this.googleOAuth.exchangeCodeForTokens(code);
      await this.persistConnection(decodedState, tokens);
      return this.redirectUrl('success', { email: tokens.email });
    } catch (error) {
      this.logger.error(
        `Google OAuth callback failed: ${(error as Error).message}`,
      );
      return this.redirectUrl('error', {
        reason: (error as Error).message || 'connection_failed',
      });
    }
  }

  /** Marks an integration as the org's active sender (deactivating others). */
  async activate(
    id: string,
    user: LoggedInUser,
  ): Promise<EmailIntegrationResponseDto> {
    const integration = await this.getOwnedOrThrow(id, user);

    await this.repository.deactivateAllForOrg(user.organizationId);
    await this.repository.update(id, {
      is_active: true,
      modified_by: user.userId,
      modified_at: new Date(),
    });

    integration.is_active = true;
    return EmailIntegrationResponseDto.fromEntity(integration);
  }

  /** Turns off an integration without disconnecting it. */
  async deactivate(
    id: string,
    user: LoggedInUser,
  ): Promise<EmailIntegrationResponseDto> {
    const integration = await this.getOwnedOrThrow(id, user);

    await this.repository.update(id, {
      is_active: false,
      modified_by: user.userId,
      modified_at: new Date(),
    });

    integration.is_active = false;
    return EmailIntegrationResponseDto.fromEntity(integration);
  }

  /** Disconnects (soft-delete) and best-effort revokes the token at Google. */
  async disconnect(id: string, user: LoggedInUser): Promise<void> {
    const integration = await this.getOwnedOrThrow(id, user);

    try {
      const refreshToken = this.encryption.decrypt(
        integration.refresh_token_encrypted,
      );
      await this.googleOAuth.revokeToken(refreshToken);
    } catch (error) {
      // Never block the local disconnect on a Google-side failure.
      this.logger.warn(
        `Could not revoke token during disconnect of ${integration.email}: ${
          (error as Error).message
        }`,
      );
    }

    await this.repository.update(id, {
      status: Status.DELETED,
      is_active: false,
      deleted_by: user.userId,
      deleted_at: new Date(),
    });
  }

  /** Sends a test email through a specific integration to verify it works. */
  async sendTest(
    id: string,
    dto: TestEmailDto,
    user: LoggedInUser,
  ): Promise<{ sent: boolean; to: string }> {
    const integration = await this.getOwnedOrThrow(id, user);
    const to = dto.to ?? integration.email;

    await this.gmailSender.sendViaIntegration(integration, {
      to,
      subject: 'Brello — test email',
      html: `<div style="font-family: sans-serif; padding: 24px">
        <p>This is a test email sent from your connected Gmail account
        <strong>${integration.email}</strong> via Brello.</p>
        <p>If you received this, your email integration is working correctly.</p>
      </div>`,
    });

    return { sent: true, to };
  }

  // ────────────────────────────────────────────────────────────────────────

  private async persistConnection(
    state: OAuthStatePayload,
    tokens: GoogleTokenResult,
  ): Promise<void> {
    const encryptedToken = this.encryption.encrypt(tokens.refreshToken);

    // Re-connecting the same Google account → refresh the stored token in place.
    const existing = await this.repository.findByEmailForOrg(
      tokens.email,
      state.organizationId,
    );

    if (existing) {
      await this.repository.update(existing.id, {
        refresh_token_encrypted: encryptedToken,
        display_name: tokens.displayName ?? existing.display_name,
        google_sub: tokens.googleSub ?? existing.google_sub,
        scope: tokens.scope ?? existing.scope,
        token_expires_at: tokens.expiryDate ?? undefined,
        modified_by: state.userId,
        modified_at: new Date(),
      });
      this.logger.log(
        `Refreshed existing Gmail connection ${tokens.email} for org ${state.organizationId}`,
      );
      return;
    }

    // The organization's FIRST connection becomes the active sender by default.
    const existingCount = (
      await this.repository.findAllForOrg(state.organizationId)
    ).length;
    const makeActive = existingCount === 0;

    await this.repository.create({
      provider: EmailProvider.GMAIL,
      email: tokens.email,
      display_name: tokens.displayName ?? undefined,
      google_sub: tokens.googleSub,
      refresh_token_encrypted: encryptedToken,
      scope: tokens.scope ?? undefined,
      token_expires_at: tokens.expiryDate ?? undefined,
      is_active: makeActive,
      status: Status.ACTIVE,
      organization_id: state.organizationId,
      enterprise_id: state.enterpriseId,
      connected_by: state.userId,
    });

    this.logger.log(
      `Connected new Gmail account ${tokens.email} for org ${state.organizationId} (active=${makeActive})`,
    );
  }

  private async getOwnedOrThrow(
    id: string,
    user: LoggedInUser,
  ): Promise<EmailIntegration> {
    const integration = await this.repository.findByIdForOrg(
      id,
      user.organizationId,
    );
    if (!integration) {
      throw new NotFoundException(
        `Email integration with ID "${id}" not found`,
      );
    }
    return integration;
  }

  private redirectUrl(
    connected: 'success' | 'error',
    params: Record<string, string>,
  ): string {
    const base = this.frontendRedirectUrl.replace(/\/$/, '');
    const query = new URLSearchParams({ connected, ...params }).toString();
    return `${base}?${query}`;
  }
}
