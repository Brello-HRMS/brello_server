import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * JWT Auth Guard
 * 
 * Guard that protects routes requiring authentication.
 * Uses the JWT strategy to validate access tokens.
 * 
 * Design Pattern: Guard Pattern
 * - Controls access to routes based on authentication
 * - Declarative security using decorators
 * 
 * Usage:
 * ```typescript
 * @UseGuards(JwtAuthGuard)
 * @Get('profile')
 * getProfile(@CurrentUser() user: JwtPayload) {
 *   return user;
 * }
 * ```
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') { }
