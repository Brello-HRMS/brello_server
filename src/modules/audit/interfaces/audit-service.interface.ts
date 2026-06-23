import { CreateAuditLogDto } from '../dto/create-audit-log.dto';

/**
 * The public contract for writing audit events.
 *
 * Only log() and logBatch() are on this interface — query methods stay
 * on AuditService directly because they are only called from within
 * the audit module's own controllers.
 *
 * Microservice extraction path:
 *   1. Create AuditServiceProxy implements IAuditService
 *   2. AuditServiceProxy.log() publishes CreateAuditLogDto to a queue (Redis/Kafka/SQS)
 *   3. In audit.module.ts swap: { provide: AUDIT_SERVICE_TOKEN, useClass: AuditServiceProxy }
 *   4. Zero changes in callers (AuthService, EmployeeService, etc.)
 */
export interface IAuditService {
  log(dto: CreateAuditLogDto): Promise<void>;
  logBatch(dtos: CreateAuditLogDto[]): Promise<void>;
}

export const AUDIT_SERVICE_TOKEN = Symbol('IAuditService');
