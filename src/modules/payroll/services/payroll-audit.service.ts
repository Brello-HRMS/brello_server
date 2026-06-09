import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { PayrollAuditLog } from '../entities/payroll-audit-log.entity';
import { LoggedInUser } from '../../auth/interfaces/logged-in-user.interface';
import { AuditAction } from '../enums/payroll.enum';

/**
 * Centralised payroll audit-trail writer. Every payroll-run lifecycle mutation
 * (create, prepare, process, lock, delete, adjust) records an entry here.
 */
@Injectable()
export class PayrollAuditService {
  constructor(
    @InjectRepository(PayrollAuditLog)
    private readonly auditRepo: Repository<PayrollAuditLog>,
  ) {}

  async record(
    user: LoggedInUser,
    entityType: string,
    entityId: string,
    action: AuditAction,
    before: Record<string, any> | null,
    after: Record<string, any> | null,
  ): Promise<void> {
    const entry = this.auditRepo.create({
      enterprise_id: user.enterpriseId,
      organization_id: user.organizationId,
      entity_type: entityType,
      entity_id: entityId,
      action,
      before_data: before ?? undefined,
      after_data: after ?? undefined,
      changed_by: user.userId,
    });
    await this.auditRepo.save(entry);
  }

  /** Returns the audit trail for a set of entity ids (run + its items/adjustments). */
  async listForEntities(
    organizationId: string,
    entityIds: string[],
  ): Promise<PayrollAuditLog[]> {
    if (!entityIds.length) return [];
    return this.auditRepo.find({
      where: { organization_id: organizationId, entity_id: In(entityIds) },
      order: { created_at: 'ASC' },
    });
  }
}
