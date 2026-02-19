import { SetMetadata } from '@nestjs/common';

export const PERMISSION_KEY = 'require_permission';

export interface PermissionRequirement {
    /** WBS code of the module (e.g., '1', '1.2', '1.2.1') */
    moduleWbsCode: string;
    /** Action name (e.g., 'view', 'create', 'update', 'delete', 'approve') */
    actionName: string;
}

/**
 * @RequirePermission decorator
 *
 * Use on any route handler to enforce RBAC access.
 *
 * Example:
 *   @RequirePermission('1.1', 'view')
 *   @RequirePermission('2.3.1', 'approve')
 *
 * Guards: Must be combined with @UseGuards(JwtAuthGuard, AccessGuard)
 * or apply AccessGuard globally.
 */
export const RequirePermission = (
    moduleWbsCode: string,
    actionName: string,
): MethodDecorator & ClassDecorator =>
    SetMetadata(PERMISSION_KEY, { moduleWbsCode, actionName } as PermissionRequirement);
