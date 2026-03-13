import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { SessionRepository } from '../repositories/session.repository';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { hashValue, calculateSessionExpiration } from '../utils';

export interface CreateSessionParams {
  userId: string;
  organizationId: string;
  enterpriseId: string;
  isPlatformAdmin: boolean;
  deviceFingerprint?: string;
  appId?: string;
}

export interface TokenResult {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly sessionRepository: SessionRepository,
  ) {}

  generateAccessToken(payload: JwtPayload): string {
    const plainPayload = { ...payload };
    const expiresIn =
      this.configService.get<string>('auth.JWT_ACCESS_EXPIRATION') ?? '15m';
    return this.jwtService.sign(plainPayload, {
      secret:
        this.configService.get<string>('auth.JWT_SECRET') || 'default-secret',
      expiresIn: expiresIn as any,
    });
  }

  generateRefreshToken(payload: JwtPayload): string {
    const plainPayload = { ...payload };
    const expiresIn =
      this.configService.get<string>('auth.JWT_REFRESH_EXPIRATION') ?? '7d';
    return this.jwtService.sign(plainPayload, {
      secret:
        this.configService.get<string>('auth.JWT_REFRESH_SECRET') ||
        'default-refresh-secret',
      expiresIn: expiresIn as any,
    });
  }

  async createSessionAndTokens(
    params: CreateSessionParams,
  ): Promise<TokenResult> {
    const refreshToken = Math.random().toString(36).substring(2);
    const refreshTokenHash = await hashValue(refreshToken);

    const session = await this.sessionRepository.create({
      user_id: params.userId,
      refresh_token_hash: refreshTokenHash,
      device_fingerprint: params.deviceFingerprint || 'unknown',
      login_time: new Date(),
      last_activity: new Date(),
      expires_at: calculateSessionExpiration(this.configService),
      app_id: params.appId,
    });

    const tokenPayload: JwtPayload = {
      userId: params.userId,
      sessionId: session.id,
      organizationId: params.organizationId,
      enterpriseId: params.enterpriseId,
      appId: params.appId as string,
      isPlatformAdmin: params.isPlatformAdmin,
    };

    return {
      access_token: this.generateAccessToken(tokenPayload),
      refresh_token: this.generateRefreshToken({
        ...tokenPayload,
        refreshToken,
      }),
      expires_in: 900,
    };
  }
}
