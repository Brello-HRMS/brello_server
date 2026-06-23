import { Injectable, Logger } from '@nestjs/common';
import { AuditLogRepository } from '../repositories/audit-log.repository';
import { AuditActorResolver } from './audit-actor-resolver.service';
import { AuditContextService } from './audit-context.service';
import { CreateAuditLogDto } from '../dto/create-audit-log.dto';
import { AuditLogQueryDto, PlatformAuditLogQueryDto } from '../dto/audit-log-query.dto';
import { IAuditService } from '../interfaces/audit-service.interface';

@Injectable()
export class AuditService implements IAuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    private readonly auditRepo: AuditLogRepository,
    private readonly actorResolver: AuditActorResolver,
    private readonly auditContext: AuditContextService,
  ) {}

  async log(dto: CreateAuditLogDto): Promise<void> {
    try {
      const ctx = this.auditContext.getContext();
      const actor = await this.actorResolver.resolve(dto.actor_id);

      await this.auditRepo.insert({
        ...dto,
        actor_name: actor.name,
        actor_email: actor.email,
        // Context-injected values take precedence over manually passed values
        old_value: ctx?.preValue ?? dto.old_value,
        ip_address: ctx?.ip ?? dto.ip_address,
        user_agent: ctx?.userAgent ?? dto.user_agent,
      });
    } catch (err) {
      this.logger.error('AuditService.log failed', err);
    }
  }

  async logBatch(dtos: CreateAuditLogDto[]): Promise<void> {
    await Promise.allSettled(dtos.map((dto) => this.log(dto)));
  }

  // ── Query methods (called only from AuditController / PlatformAuditController) ──

  async findByOrg(organizationId: string, query: AuditLogQueryDto) {
    const { items, total } = await this.auditRepo.findByOrg(organizationId, query);
    return { items, pagination: this.buildPagination(query, total) };
  }

  async findByPlatform(query: PlatformAuditLogQueryDto) {
    const { items, total } = await this.auditRepo.findByPlatform(query);
    return { items, pagination: this.buildPagination(query, total) };
  }

  async findEntityHistory(organizationId: string, entityType: string, entityId: string) {
    return this.auditRepo.findEntityHistory(organizationId, entityType, entityId);
  }

  async getStatsByOrg(organizationId: string, dateFrom?: string, dateTo?: string) {
    return this.auditRepo.getStatsByOrg(organizationId, dateFrom, dateTo);
  }

  async getPlatformStats(dateFrom?: string, dateTo?: string) {
    return this.auditRepo.getPlatformStats(dateFrom, dateTo);
  }

  async getFilterOptions(organizationId?: string) {
    return this.auditRepo.getFilterOptions(organizationId);
  }

  private buildPagination(query: AuditLogQueryDto, total: number) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    return { page, limit, total, total_pages: Math.ceil(total / limit) };
  }
}
