import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';

/**
 * Guard for SSE endpoints where EventSource cannot set Authorization headers.
 * Reads the JWT from either the Authorization header or the `token` query param.
 * Sets both request.user (for Passport compatibility) and request.loggedInUser
 * (for the @LoggedInUser() decorator) so it integrates with existing auth infrastructure.
 */
@Injectable()
export class SseJwtGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();

    let token: string | undefined =
      (request.query?.token as string) || undefined;

    if (!token) {
      const authHeader = request.headers?.authorization as string | undefined;
      if (authHeader?.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
      }
    }

    if (!token) {
      throw new UnauthorizedException('No authentication token provided');
    }

    try {
      const secret =
        this.configService.get<string>('auth.JWT_SECRET') || 'default-secret';
      const payload = jwt.verify(token, secret) as Record<string, any>;

      request.user = payload;
      request.loggedInUser = {
        userId: payload.userId,
        enterpriseId: payload.enterpriseId,
        organizationId: payload.organizationId,
        appId: payload.appId,
        isPlatformAdmin: !!payload.isPlatformAdmin,
      };

      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
