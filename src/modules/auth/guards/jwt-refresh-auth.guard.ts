import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * JWT Refresh Auth Guard
 *
 * Guard that protects the token refresh endpoint.
 * Uses the JWT refresh strategy to validate refresh tokens.
 *
 * Design Pattern: Guard Pattern
 * - Controls access to refresh endpoint
 * - Ensures only valid refresh tokens can get new access tokens
 *
 * Usage:
 * ```typescript
 * @UseGuards(JwtRefreshAuthGuard)
 * @Post('refresh')
 * refresh(@CurrentUser() user: JwtPayload) {
 *   return this.authService.refreshToken(user);
 * }
 * ```
 */
@Injectable()
export class JwtRefreshAuthGuard extends AuthGuard('jwt-refresh') {}
