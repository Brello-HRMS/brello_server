import {
    Injectable,
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
    PERMISSION_KEY,
    PermissionRequirement,
} from './require-permission.decorator';
import { PermissionResolverService } from '../../modules/rbac/services/permission-resolver.service';
import type { JwtPayload } from '../../modules/auth/interfaces/jwt-payload.interface';

/**
 * AccessGuard
 *
 * Enforces RBAC permissions on routes decorated with @RequirePermission.
 *
 * Must be used AFTER JwtAuthGuard (so that request.user is populated).
 *
 * Usage:
 *   @UseGuards(JwtAuthGuard, AccessGuard)
 *   @RequirePermission('1.2', 'create')
 *
 * Flow:
 *   1. Read module code + action name from route metadata
 *   2. Extract userId, organizationId, appId from request.user (JWT payload)
 *   3. Call PermissionResolverService.hasPermission(...)
 *   4. Throw 403 Forbidden if permission is denied
 */
@Injectable()
export class AccessGuard implements CanActivate {
    private readonly logger = new Logger(AccessGuard.name);

    constructor(
        private readonly reflector: Reflector,
        private readonly permissionResolver: PermissionResolverService,
    ) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const requirement = this.reflector.getAllAndOverride<PermissionRequirement>(
            PERMISSION_KEY,
            [context.getHandler(), context.getClass()],
        );

        // No @RequirePermission → allow (guard is a no-op)
        if (!requirement) {
            return true;
        }

        const request = context.switchToHttp().getRequest<{ user: JwtPayload }>();
        const user = request.user;

        if (!user?.userId || !user?.organizationId || !user?.appId) {
            throw new ForbiddenException('Authentication context is missing.');
        }

        const { moduleCode, actionName } = requirement;

        const allowed = await this.permissionResolver.hasPermission(
            user.userId,
            user.organizationId,
            user.appId,
            moduleCode,
            actionName,
        );

        if (!allowed) {
            this.logger.warn(
                `Access denied: user ${user.userId} cannot perform [${actionName}] on module [${moduleCode}]`,
            );
            throw new ForbiddenException(
                `You do not have permission to perform [${actionName}] on this resource.`,
            );
        }

        return true;
    }
}
