import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

/**
 * JWT Refresh Strategy
 * 
 * Implements Passport JWT strategy for refresh token validation.
 * This strategy is used specifically for the token refresh endpoint.
 * 
 * Design Pattern: Strategy Pattern
 * - Encapsulates the refresh token validation algorithm
 * - Separate from access token strategy for security
 * 
 * How it works:
 * 1. Extracts JWT from Authorization header (Bearer token)
 * 2. Validates JWT signature using refresh secret key (different from access)
 * 3. Validates expiration
 * 4. Returns payload if valid, throws UnauthorizedException if invalid
 */
@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
    Strategy,
    'jwt-refresh',
) {
    constructor(private configService: ConfigService) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: configService.get<string>('JWT_REFRESH_SECRET') || 'default-refresh-secret-change-me',
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
