import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';

/**
 * CookieService
 *
 * Encapsulates all refresh-token cookie operations (set / clear).
 * Cookie configuration is driven entirely from YAML properties
 * so it can differ per environment (dev vs prod).
 *
 * Security flags:
 *  - httpOnly: true  → JS cannot read the cookie (XSS immune)
 *  - secure:   true  → cookie only sent over HTTPS (enforce in prod)
 *  - sameSite: strict → cookie not sent on cross-origin requests (CSRF protection)
 *  - path:     /api/v1/auth → cookie only attached to auth endpoints
 */
@Injectable()
export class CookieService {
    private readonly cookieName: string;
    private readonly httpOnly: boolean;
    private readonly secure: boolean;
    private readonly sameSite: 'strict' | 'lax' | 'none';
    private readonly path: string;
    private readonly maxAgeMs: number;
    private readonly domain: string;

    constructor(private readonly configService: ConfigService) {
        this.cookieName = this.configService.get<string>(
            'cookie.refreshTokenName',
            'refresh_token',
        );
        this.httpOnly = this.configService.get<boolean>('cookie.httpOnly', true);
        this.secure = this.configService.get<boolean>('cookie.secure', false);
        this.sameSite = this.configService.get<'strict' | 'lax' | 'none'>(
            'cookie.sameSite',
            'strict',
        );
        this.path = this.configService.get<string>('cookie.path', '/api/v1/auth');
        this.domain = this.configService.get<string>('cookie.domain', '');

        const maxAgeDays = this.configService.get<number>('cookie.maxAgeDays', 7);
        this.maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
    }

    /** Attach the refresh token JWT as an HttpOnly cookie on the response. */
    setRefreshTokenCookie(res: Response, refreshToken: string): void {
        const options: {
            httpOnly: boolean;
            secure: boolean;
            sameSite: 'strict' | 'lax' | 'none';
            path: string;
            maxAge: number;
            domain?: string;
        } = {
            httpOnly: this.httpOnly,
            secure: this.secure,
            sameSite: this.sameSite,
            path: this.path,
            maxAge: this.maxAgeMs,
        };

        if (this.domain) {
            options.domain = this.domain;
        }

        res.cookie(this.cookieName, refreshToken, options);
    }

    /** Clear the refresh token cookie (e.g. on logout). */
    clearRefreshTokenCookie(res: Response): void {
        const options: {
            httpOnly: boolean;
            secure: boolean;
            sameSite: 'strict' | 'lax' | 'none';
            path: string;
            domain?: string;
        } = {
            httpOnly: this.httpOnly,
            secure: this.secure,
            sameSite: this.sameSite,
            path: this.path,
        };

        if (this.domain) {
            options.domain = this.domain;
        }

        res.clearCookie(this.cookieName, options);
    }
}
