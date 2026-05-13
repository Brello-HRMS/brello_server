import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AttendanceAuditLog } from '../entities/attendance-audit-log.entity';
import { AuditEventType } from '../enums/audit-event-type.enum';

@Injectable()
export class AttendanceAuditLogRepository {
  constructor(
    @InjectRepository(AttendanceAuditLog)
    private readonly repo: Repository<AttendanceAuditLog>,
  ) {}

  async create(data: Partial<AttendanceAuditLog>): Promise<AttendanceAuditLog> {
    return this.repo.save(this.repo.create(data));
  }

  async list(filters: {
    organizationId: string;
    employeeId?: string;
    date?: string;
    eventType?: AuditEventType;
    page: number;
    limit: number;
  }): Promise<{ data: AttendanceAuditLog[]; total: number }> {
    const qb = this.repo
      .createQueryBuilder('a')
      .where('a.organization_id = :orgId', { orgId: filters.organizationId });

    if (filters.employeeId) {
      qb.andWhere('a.employee_id = :empId', { empId: filters.employeeId });
    }
    if (filters.eventType) {
      qb.andWhere('a.event_type = :eventType', {
        eventType: filters.eventType,
      });
    }
    if (filters.date) {
      qb.andWhere('DATE(a.created_at) = :date', { date: filters.date });
    }

    qb.orderBy('a.created_at', 'DESC')
      .skip((filters.page - 1) * filters.limit)
      .take(filters.limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total };
  }
}
