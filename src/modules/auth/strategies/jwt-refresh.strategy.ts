import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import type { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

/**
 * JWT Refresh Strategy
 *
 * Extracts the refresh token JWT from an HttpOnly cookie (not the Authorization header).
 * This is more secure because HttpOnly cookies are invisible to JavaScript,
 * eliminating the XSS vector for refresh-token theft.
 *
 * Cookie name is driven by config: `cookie.refreshTokenName` (default: 'refresh_token').
 *
 * Design Pattern: Strategy Pattern
 * - Encapsulates the refresh token validation algorithm
 * - Separate from access token strategy for security
 */
@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(private configService: ConfigService) {
    const cookieName = configService.get<string>(
      'cookie.refreshTokenName',
      'refresh_token',
    );

    super({
      jwtFromRequest: (req: Request) => {
        return req?.cookies?.[cookieName] || null;
      },
      ignoreExpiration: false,
      secretOrKey:
        configService.get<string>('auth.JWT_REFRESH_SECRET') ||
        'default-refresh-secret',
    });
  }

  /**
   * Validate refresh token payload
   *
   * This method is called automatically by Passport after JWT is verified.
   * The payload is attached to the request object as req.user
   *
   * @param payload - Decoded JWT payload
   * @returns Payload to be attached to request
   */
  async validate(payload: JwtPayload): Promise<JwtPayload> {
    // Validate that this is a refresh token
    if (!payload.userId || !payload.sessionId || !payload.refreshToken) {
      throw new UnauthorizedException('Invalid refresh token payload');
    }

    return payload;
  }
}
