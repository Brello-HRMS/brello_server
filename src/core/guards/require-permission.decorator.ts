import { SetMetadata } from '@nestjs/common';

export const PERMISSION_KEY = 'require_permission';

export interface PermissionRequirement {
  /** Module code (e.g., 'LEAVE_MGMT', 'ATTENDANCE'). WBS is for hierarchy only. */
  moduleCode: string;
  /** Action name (e.g., 'view', 'create', 'update', 'delete', 'approve') */
  actionName: string;
}

/**
 * @RequirePermission decorator
 *
 * Use on any route handler to enforce RBAC access.
 *
 * Example:
 *   @RequirePermission('LEAVE_MGMT', 'view')
 *   @RequirePermission('ATTENDANCE', 'approve')
 *
 * Guards: Must be combined with @UseGuards(JwtAuthGuard, AccessGuard)
 * or apply AccessGuard globally.
 */
export const RequirePermission = (
  moduleCode: string,
  actionName: string,
): MethodDecorator & ClassDecorator =>
  SetMetadata(PERMISSION_KEY, {
    moduleCode,
    actionName,
  } as PermissionRequirement);
