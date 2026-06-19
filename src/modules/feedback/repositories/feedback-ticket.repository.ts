import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { FeedbackTicket } from '../entities/feedback-ticket.entity';
import { FeedbackStatus } from '../enums/feedback-status.enum';
import { FeedbackPriority } from '../enums/feedback-priority.enum';
import { OrgQueryFeedbackDto } from '../dto/org-query-feedback.dto';
import { PlatformQueryFeedbackDto } from '../dto/platform-query-feedback.dto';

@Injectable()
export class FeedbackTicketRepository {
  constructor(
    @InjectRepository(FeedbackTicket)
    private readonly repo: Repository<FeedbackTicket>,
  ) {}

  async create(data: Partial<FeedbackTicket>): Promise<FeedbackTicket> {
    const ticket = this.repo.create(data);
    return this.repo.save(ticket);
  }

  async findById(id: string): Promise<FeedbackTicket | null> {
    return this.repo.findOne({ where: { id, deleted_at: IsNull() } });
  }

  async findByIdAndOrg(id: string, organizationId: string): Promise<FeedbackTicket | null> {
    return this.repo.findOne({
      where: { id, organization_id: organizationId, deleted_at: IsNull() },
    });
  }

  async findByOrg(
    organizationId: string,
    enterpriseId: string,
    query: OrgQueryFeedbackDto,
  ): Promise<[FeedbackTicket[], number]> {
    const qb = this.repo
      .createQueryBuilder('t')
      .where('t.organization_id = :organizationId', { organizationId })
      .andWhere('t.enterprise_id = :enterpriseId', { enterpriseId })
      .andWhere('t.deleted_at IS NULL');

    if (query.type) qb.andWhere('t.type = :type', { type: query.type });
    if (query.category) qb.andWhere('t.category = :category', { category: query.category });
    if (query.status) qb.andWhere('t.ticket_status = :status', { status: query.status });

    qb.orderBy('t.created_at', 'DESC');

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    qb.skip((page - 1) * limit).take(limit);

    return qb.getManyAndCount();
  }

  async findAll(query: PlatformQueryFeedbackDto): Promise<[FeedbackTicket[], number]> {
    const qb = this.repo
      .createQueryBuilder('t')
      .where('t.deleted_at IS NULL');

    if (query.organization_id) qb.andWhere('t.organization_id = :orgId', { orgId: query.organization_id });
    if (query.enterprise_id) qb.andWhere('t.enterprise_id = :enterpriseId', { enterpriseId: query.enterprise_id });
    if (query.type) qb.andWhere('t.type = :type', { type: query.type });
    if (query.category) qb.andWhere('t.category = :category', { category: query.category });
    if (query.status) qb.andWhere('t.ticket_status = :status', { status: query.status });
    if (query.priority) qb.andWhere('t.priority = :priority', { priority: query.priority });
    if (query.affected_module) qb.andWhere('t.affected_module = :module', { module: query.affected_module });
    if (query.from_date) qb.andWhere('t.created_at >= :from', { from: query.from_date });
    if (query.to_date) qb.andWhere('t.created_at <= :to', { to: query.to_date });

    qb.orderBy('t.created_at', 'DESC');

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    qb.skip((page - 1) * limit).take(limit);

    return qb.getManyAndCount();
  }

  async updateStatus(
    ticket: FeedbackTicket,
    newStatus: FeedbackStatus,
    adminId: string,
  ): Promise<FeedbackTicket> {
    ticket.ticket_status = newStatus;
    ticket.modified_by = adminId;
    ticket.modified_at = new Date();

    if (newStatus === FeedbackStatus.RESOLVED) ticket.resolved_at = new Date();
    if (newStatus === FeedbackStatus.CLOSED) ticket.closed_at = new Date();

    return this.repo.save(ticket);
  }

  async updatePriority(
    ticket: FeedbackTicket,
    priority: FeedbackPriority,
    adminId: string,
  ): Promise<FeedbackTicket> {
    ticket.priority = priority;
    ticket.modified_by = adminId;
    ticket.modified_at = new Date();
    return this.repo.save(ticket);
  }

  async getStats(): Promise<{
    total: number;
    by_status: Record<string, number>;
    by_type: Record<string, number>;
    by_priority: Record<string, number>;
  }> {
    const [byStatus, byType, byPriority] = await Promise.all([
      this.repo
        .createQueryBuilder('t')
        .select('t.ticket_status', 'status')
        .addSelect('COUNT(*)', 'count')
        .where('t.deleted_at IS NULL')
        .groupBy('t.ticket_status')
        .getRawMany(),
      this.repo
        .createQueryBuilder('t')
        .select('t.type', 'type')
        .addSelect('COUNT(*)', 'count')
        .where('t.deleted_at IS NULL')
        .groupBy('t.type')
        .getRawMany(),
      this.repo
        .createQueryBuilder('t')
        .select('t.priority', 'priority')
        .addSelect('COUNT(*)', 'count')
        .where('t.deleted_at IS NULL')
        .groupBy('t.priority')
        .getRawMany(),
    ]);

    const total = byStatus.reduce((sum, row) => sum + Number(row.count), 0);

    return {
      total,
      by_status: Object.fromEntries(byStatus.map((r) => [r.status, Number(r.count)])),
      by_type: Object.fromEntries(byType.map((r) => [r.type, Number(r.count)])),
      by_priority: Object.fromEntries(byPriority.map((r) => [r.priority, Number(r.count)])),
    };
  }
}
