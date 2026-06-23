import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AttendanceCorrectionRequest } from '../entities/attendance-correction-request.entity';
import { CorrectionStatus } from '../enums/correction-status.enum';
import { CorrectionListQueryDto } from '../dto/correction-request.dto';

@Injectable()
export class AttendanceCorrectionRequestRepository {
  constructor(
    @InjectRepository(AttendanceCorrectionRequest)
    private readonly repo: Repository<AttendanceCorrectionRequest>,
  ) {}

  async create(
    data: Partial<AttendanceCorrectionRequest>,
  ): Promise<AttendanceCorrectionRequest> {
    return this.repo.save(this.repo.create(data));
  }

  async findById(
    id: string,
    organizationId: string,
  ): Promise<AttendanceCorrectionRequest | null> {
    return this.repo.findOne({
      where: { id, organization_id: organizationId, is_deleted: false },
    });
  }

  /** An open (PENDING) request for a session, if any — enforces one-at-a-time. */
  async findPendingBySession(
    sessionId: string,
  ): Promise<AttendanceCorrectionRequest | null> {
    return this.repo.findOne({
      where: {
        attendance_session_id: sessionId,
        approval_status: CorrectionStatus.PENDING,
        is_deleted: false,
      },
    });
  }

  async update(
    id: string,
    data: Partial<AttendanceCorrectionRequest>,
  ): Promise<void> {
    await this.repo.update(id, data);
  }

  async list(
    organizationId: string,
    query: CorrectionListQueryDto,
    employeeIdScope?: string,
  ): Promise<{ data: AttendanceCorrectionRequest[]; total: number }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const qb = this.repo
      .createQueryBuilder('cr')
      .where('cr.organization_id = :organizationId', { organizationId })
      .andWhere('cr.is_deleted = false');

    if (employeeIdScope) {
      qb.andWhere('cr.employee_id = :scope', { scope: employeeIdScope });
    } else if (query.employee_id) {
      qb.andWhere('cr.employee_id = :empId', { empId: query.employee_id });
    }
    if (query.approval_status) {
      qb.andWhere('cr.approval_status = :status', { status: query.approval_status });
    }
    if (query.from_date) {
      qb.andWhere('cr.created_at >= :from', { from: query.from_date });
    }
    if (query.to_date) {
      qb.andWhere('cr.created_at <= :to', { to: query.to_date });
    }

    qb.orderBy('cr.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total };
  }
}
