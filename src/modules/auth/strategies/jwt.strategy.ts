import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

/**
 * JWT Strategy
 *
 * Implements Passport JWT strategy for access token validation.
 * This strategy is used to protect routes that require authentication.
 *
 * Design Pattern: Strategy Pattern
 * - Encapsulates the JWT validation algorithm
 * - Can be easily swapped for different authentication strategies
 *
 * How it works:
 * 1. Extracts JWT from Authorization header (Bearer token)
 * 2. Validates JWT signature using secret key
 * 3. Validates expiration
 * 4. Returns payload if valid, throws UnauthorizedException if invalid
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:
        configService.get<string>('auth.JWT_SECRET') ||
        'default-secret-change-me',
    });
  }

  /**
   * Validate JWT payload
   *
   * This method is called automatically by Passport after JWT is verified.
   * The payload is attached to the request object as req.user
   *
   * @param payload - Decoded JWT payload
   * @returns Payload to be attached to request
   */
  async validate(payload: JwtPayload): Promise<JwtPayload> {
    if (!payload.userId || !payload.sessionId) {
      throw new UnauthorizedException('Invalid token payload');
    }

    if (!payload.appId || !payload.organizationId) {
      throw new UnauthorizedException(
        'Token missing app or organization context',
      );
    }

    return payload;
  }
}
