import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { AttendanceSession } from '../entities/attendance-session.entity';

@Injectable()
export class AttendanceSessionRepository {
  constructor(
    @InjectRepository(AttendanceSession)
    private readonly repo: Repository<AttendanceSession>,
  ) {}

  async create(data: Partial<AttendanceSession>): Promise<AttendanceSession> {
    return this.repo.save(this.repo.create(data));
  }

  async update(id: string, data: Partial<AttendanceSession>): Promise<void> {
    await this.repo.update(id, data);
  }

  async findOpenSession(
    organizationId: string,
    employeeId: string,
  ): Promise<AttendanceSession | null> {
    return this.repo.findOne({
      where: {
        organization_id: organizationId,
        employee_id: employeeId,
        check_out_at: IsNull(),
      },
      order: { check_in_at: 'DESC' },
    });
  }

  async findByRecord(recordId: string): Promise<AttendanceSession[]> {
    return this.repo.find({
      where: { attendance_record_id: recordId },
      order: { check_in_at: 'ASC' },
    });
  }

  async deleteByRecord(recordId: string): Promise<void> {
    await this.repo.delete({ attendance_record_id: recordId });
  }
}
