import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { SystemAuditLog } from '../entities/system-audit-log.entity';
import { CreateAuditLogDto } from '../dto/create-audit-log.dto';
import { AuditLogQueryDto, PlatformAuditLogQueryDto } from '../dto/audit-log-query.dto';
import { computeChangedFields } from '../utils/diff.util';
import { sanitizeForAudit } from '../utils/sanitize.util';

@Injectable()
export class AuditLogRepository {
  private readonly logger = new Logger(AuditLogRepository.name);

  constructor(
    @InjectRepository(SystemAuditLog)
    private readonly repo: Repository<SystemAuditLog>,
  ) {}

  async insert(dto: CreateAuditLogDto & { actor_name: string; actor_email: string }): Promise<void> {
    try {
      const changedFields = computeChangedFields(dto.old_value, dto.new_value);
      const entry = this.repo.create({
        enterprise_id: dto.enterprise_id,
        organization_id: dto.organization_id ?? null,
        actor_id: dto.actor_id,
        actor_name: dto.actor_name,
        actor_email: dto.actor_email,
        is_platform_admin: dto.is_platform_admin,
        module: dto.module,
        sub_module: dto.sub_module ?? null,
        action: dto.action,
        entity_type: dto.entity_type,
        entity_id: dto.entity_id,
        entity_display_name: dto.entity_display_name ?? null,
        description: dto.description ?? null,
        old_value: sanitizeForAudit(dto.old_value) ?? null,
        new_value: sanitizeForAudit(dto.new_value) ?? null,
        changed_fields: changedFields.length ? changedFields : null,
        ip_address: dto.ip_address ?? null,
        user_agent: dto.user_agent ?? null,
        device: dto.device ?? null,
        request_id: dto.request_id ?? null,
      });
      await this.repo.save(entry);
    } catch (err) {
      this.logger.error('Failed to write audit log entry', err);
    }
  }

  async findByOrg(
    organizationId: string,
    query: AuditLogQueryDto,
  ): Promise<{ items: SystemAuditLog[]; total: number }> {
    const qb = this.repo
      .createQueryBuilder('log')
      .where('log.organization_id = :organizationId', { organizationId });

    this.applyCommonFilters(qb, query);

    const total = await qb.getCount();
    const { page = 1, limit = 20, sort_by = 'created_at', sort_order = 'DESC' } = query;

    const items = await qb
      .orderBy(`log.${sort_by}`, sort_order)
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return { items, total };
  }

  async findByPlatform(
    query: PlatformAuditLogQueryDto,
  ): Promise<{ items: SystemAuditLog[]; total: number }> {
    const qb = this.repo.createQueryBuilder('log');

    if (query.organization_id) {
      qb.where('log.organization_id = :orgId', { orgId: query.organization_id });
    }
    if (query.enterprise_id_filter) {
      qb.andWhere('log.enterprise_id = :eid', { eid: query.enterprise_id_filter });
    }

    this.applyCommonFilters(qb, query);

    const total = await qb.getCount();
    const { page = 1, limit = 20, sort_by = 'created_at', sort_order = 'DESC' } = query;

    const items = await qb
      .orderBy(`log.${sort_by}`, sort_order)
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return { items, total };
  }

  async findEntityHistory(
    organizationId: string,
    entityType: string,
    entityId: string,
  ): Promise<SystemAuditLog[]> {
    return this.repo.find({
      where: { organization_id: organizationId, entity_type: entityType, entity_id: entityId },
      order: { created_at: 'ASC' },
      take: 500,
    });
  }

  async getStatsByOrg(organizationId: string, dateFrom?: string, dateTo?: string) {
    const qb = this.repo
      .createQueryBuilder('log')
      .where('log.organization_id = :organizationId', { organizationId });
    return this.computeStats(qb, dateFrom, dateTo);
  }

  async getPlatformStats(dateFrom?: string, dateTo?: string) {
    const qb = this.repo.createQueryBuilder('log');
    return this.computeStats(qb, dateFrom, dateTo);
  }

  private applyCommonFilters(qb: SelectQueryBuilder<SystemAuditLog>, query: AuditLogQueryDto): void {
    if (query.date_from) qb.andWhere('log.created_at >= :from', { from: query.date_from });
    if (query.date_to) {
      const end = new Date(query.date_to);
      end.setHours(23, 59, 59, 999);
      qb.andWhere('log.created_at <= :to', { to: end.toISOString() });
    }
    if (query.module) qb.andWhere('log.module = :module', { module: query.module });
    if (query.action) qb.andWhere('log.action = :action', { action: query.action });
    if (query.actor_id) qb.andWhere('log.actor_id = :actorId', { actorId: query.actor_id });
    if (query.entity_type) qb.andWhere('log.entity_type = :et', { et: query.entity_type });
    if (query.entity_id) qb.andWhere('log.entity_id = :eid', { eid: query.entity_id });
    if (query.changed_field) qb.andWhere(':field = ANY(log.changed_fields)', { field: query.changed_field });
    if (query.search) {
      qb.andWhere(
        '(log.actor_name ILIKE :search OR log.entity_display_name ILIKE :search OR log.description ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }
  }

  async getFilterOptions(organizationId?: string): Promise<{ modules: string[]; actions: string[] }> {
    const base = this.repo.createQueryBuilder('log');
    if (organizationId) {
      base.where('log.organization_id = :organizationId', { organizationId });
    }

    const [modules, actions] = await Promise.all([
      base.clone().select('DISTINCT log.module', 'module').orderBy('log.module', 'ASC').getRawMany<{ module: string }>(),
      base.clone().select('DISTINCT log.action', 'action').orderBy('log.action', 'ASC').getRawMany<{ action: string }>(),
    ]);

    return {
      modules: modules.map((r) => r.module),
      actions: actions.map((r) => r.action),
    };
  }

  private async computeStats(qb: SelectQueryBuilder<SystemAuditLog>, dateFrom?: string, dateTo?: string) {
    if (dateFrom) qb.andWhere('log.created_at >= :from', { from: dateFrom });
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      qb.andWhere('log.created_at <= :to', { to: end.toISOString() });
    }

    const [byModule, byAction] = await Promise.all([
      qb.clone().select('log.module', 'module').addSelect('COUNT(*)', 'count').groupBy('log.module').getRawMany(),
      qb.clone().select('log.action', 'action').addSelect('COUNT(*)', 'count').groupBy('log.action').getRawMany(),
    ]);

    const total = byModule.reduce((sum: number, r: any) => sum + Number(r.count), 0);
    return {
      total,
      by_module: Object.fromEntries(byModule.map((r: any) => [r.module, Number(r.count)])),
      by_action: Object.fromEntries(byAction.map((r: any) => [r.action, Number(r.count)])),
    };
  }
}
