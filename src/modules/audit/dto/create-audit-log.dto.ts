import { AuditLogModule } from '../enums/audit-log-module.enum';
import { AuditAction } from '../enums/audit-action.enum';

/**
 * Internal DTO — not exposed via HTTP body.
 * This is the contract callers use to write an audit event.
 * It also acts as the message schema when extracting to a microservice.
 */
export class CreateAuditLogDto {
  actor_id: string;
  enterprise_id: string;
  organization_id?: string | null;
  is_platform_admin: boolean;

  module: AuditLogModule;
  sub_module?: string;
  action: AuditAction;
  entity_type: string;
  entity_id: string;
  entity_display_name?: string;
  description?: string;

  old_value?: Record<string, unknown> | null;
  new_value?: Record<string, unknown> | null;

  // Optional request context — populated by AuditContextService when available
  ip_address?: string;
  user_agent?: string;
  device?: string;
  request_id?: string;
}
