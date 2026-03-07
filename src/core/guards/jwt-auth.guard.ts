import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * JwtAuthGuard
 *
 * Global guard for protected routes. Validates the Bearer JWT token
 * using the JwtStrategy (passport-jwt).
 *
 * Usage:
 *   @UseGuards(JwtAuthGuard)
 *
 * On success, attaches the decoded JwtPayload to request.user:
 *   { userId, sessionId, organizationId, enterpriseId, appId }
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }
}
