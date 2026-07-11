import {
  Injectable,
  Logger,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'crypto';
import { OAuth2Client } from 'google-auth-library';

import {
  GoogleTokenResult,
  OAuthStatePayload,
} from '../interfaces/oauth.interface';

/**
 * GoogleOAuthService
 *
 * Encapsulates all Google-specific OAuth concerns: building the consent URL,
 * signing/verifying the `state`, and exchanging the authorization code for a
 * refresh token + the connected account's identity.
 *
 * Scope is send-only (`gmail.send`) plus OpenID identity claims so we can learn
 * which email address was connected. No mailbox read access is requested.
 */
@Injectable()
export class GoogleOAuthService {
  private readonly logger = new Logger(GoogleOAuthService.name);

  /** Send-only Gmail + identity. Do NOT add read scopes here. */
  private static readonly SCOPES = [
    'https://www.googleapis.com/auth/gmail.send',
    'openid',
    'email',
    'profile',
  ];

  private static readonly STATE_TTL = '15m';

  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
  ) {
    this.clientId =
      this.configService.get<string>('integration.clientID') ?? '';
    this.clientSecret =
      this.configService.get<string>('integration.clientSecret') ?? '';
    this.redirectUri =
      this.configService.get<string>('integration.redirectUri') ??
      'http://localhost:8000/api/v1/email-integrations/google/callback';

    if (!this.clientId || !this.clientSecret) {
      this.logger.warn(
        'integration.clientID / integration.clientSecret not configured — Gmail connect will fail until set.',
      );
    }
  }

  private createClient(): OAuth2Client {
    if (!this.clientId || !this.clientSecret) {
      throw new BadRequestException(
        'Google OAuth is not configured on the server (missing client credentials).',
      );
    }
    return new OAuth2Client(
      this.clientId,
      this.clientSecret,
      this.redirectUri,
    );
  }

  /** Signs the org/user context into a short-lived state token. */
  buildState(
    payload: Omit<OAuthStatePayload, 'nonce'>,
  ): string {
    const state: OAuthStatePayload = {
      ...payload,
      nonce: randomBytes(16).toString('hex'),
    };
    return this.jwtService.sign(state, {
      expiresIn: GoogleOAuthService.STATE_TTL,
    });
  }

  /** Verifies and decodes a state token; throws if forged or expired. */
  verifyState(state: string): OAuthStatePayload {
    try {
      return this.jwtService.verify<OAuthStatePayload>(state);
    } catch {
      throw new UnauthorizedException(
        'Invalid or expired OAuth state. Please start the connection again.',
      );
    }
  }

  /** Builds the Google consent URL the user is redirected to. */
  generateAuthUrl(state: string): string {
    return this.createClient().generateAuthUrl({
      access_type: 'offline', // required to receive a refresh_token
      prompt: 'consent', // force refresh_token even on re-connect
      scope: GoogleOAuthService.SCOPES,
      include_granted_scopes: true,
      state,
    });
  }

  /**
   * Exchanges an authorization code for tokens and resolves the connected
   * account's identity from the id_token. Throws if Google did not return a
   * refresh token (e.g. the user previously granted access without `consent`).
   */
  async exchangeCodeForTokens(code: string): Promise<GoogleTokenResult> {
    const client = this.createClient();

    const { tokens } = await client.getToken(code);

    if (!tokens.refresh_token) {
      throw new BadRequestException(
        'Google did not return a refresh token. Remove Brello from your Google account permissions and try connecting again.',
      );
    }
    if (!tokens.id_token) {
      throw new BadRequestException(
        'Google did not return an identity token. Ensure the openid/email scopes are enabled on the OAuth client.',
      );
    }

    const loginTicket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: this.clientId,
    });
    const profile = loginTicket.getPayload();

    if (!profile?.email) {
      throw new BadRequestException(
        'Could not read the email address from the connected Google account.',
      );
    }

    return {
      email: profile.email,
      googleSub: profile.sub,
      displayName: profile.name ?? null,
      refreshToken: tokens.refresh_token,
      scope: tokens.scope ?? null,
      expiryDate: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
    };
  }

  /**
   * Best-effort revoke of a refresh token at Google (used on disconnect).
   * Never throws — revocation failure must not block the local disconnect.
   */
  async revokeToken(refreshToken: string): Promise<void> {
    try {
      await this.createClient().revokeToken(refreshToken);
    } catch (error) {
      this.logger.warn(
        `Failed to revoke Google token (continuing with local disconnect): ${
          (error as Error).message
        }`,
      );
    }
  }

  /**
   * Obtains a fresh access token from a stored refresh token — used by the
   * Gmail sender to build an OAuth2 transport.
   */
  async getAccessToken(refreshToken: string): Promise<string> {
    const client = this.createClient();
    client.setCredentials({ refresh_token: refreshToken });
    const { token } = await client.getAccessToken();
    if (!token) {
      throw new UnauthorizedException(
        'Failed to obtain a Google access token — the connection may have been revoked.',
      );
    }
    return token;
  }

  getClientCredentials(): { clientId: string; clientSecret: string } {
    return { clientId: this.clientId, clientSecret: this.clientSecret };
  }
}
