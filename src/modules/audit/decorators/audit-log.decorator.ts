import { SetMetadata } from '@nestjs/common';
import { AuditLogModule } from '../enums/audit-log-module.enum';
import { AuditAction } from '../enums/audit-action.enum';

export const AUDIT_METADATA_KEY = 'audit_log_metadata';

export interface AuditLogMetadata {
  module: AuditLogModule;
  action: AuditAction;
  entityType: string;
  entityIdParam: string;
}

/**
 * Marks a controller endpoint for automatic audit logging via AuditInterceptor.
 *
 * Use ONLY for CREATE and DELETE — for UPDATE, APPROVE, REJECT, call
 * auditService.log() manually in the service after fetching old_value.
 *
 * @param entityIdParam  Route param name to fall back to if response has no `id` (default: 'id')
 */
export const AuditLog = (
  module: AuditLogModule,
  action: AuditAction,
  entityType?: string,
  options?: { entityIdParam?: string },
) =>
  SetMetadata(AUDIT_METADATA_KEY, {
    module,
    action,
    entityType: entityType ?? module.toString(),
    entityIdParam: options?.entityIdParam ?? 'id',
  } satisfies AuditLogMetadata);
