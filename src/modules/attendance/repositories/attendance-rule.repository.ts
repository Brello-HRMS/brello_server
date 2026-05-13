import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AttendanceRule } from '../entities/attendance-rule.entity';
import { Status } from '../../../common/enums';
import { PaginationDto } from '../../../common/dto/pagination.dto';

@Injectable()
export class AttendanceRuleRepository {
  constructor(
    @InjectRepository(AttendanceRule)
    private readonly repository: Repository<AttendanceRule>,
  ) {}

  async create(data: Partial<AttendanceRule>): Promise<AttendanceRule> {
    const rule = this.repository.create(data);
    return this.repository.save(rule);
  }

  async findAllByOrg(
    organizationId: string,
    pagination: PaginationDto,
  ): Promise<{ data: AttendanceRule[]; total: number }> {
    const { page = 1, limit = 20 } = pagination;
    const [data, total] = await this.repository
      .createQueryBuilder('rule')
      .leftJoinAndSelect('rule.shift', 'shift')
      .leftJoinAndSelect('rule.weekly_off', 'weekly_off')
      .leftJoinAndSelect('rule.geo_fence', 'geo_fence')
      .where('rule.organization_id = :organizationId', { organizationId })
      .andWhere('rule.is_deleted = :isDeleted', { isDeleted: false })
      .orderBy('rule.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { data, total };
  }

  async findOneByOrg(
    id: string,
    organizationId: string,
  ): Promise<AttendanceRule | null> {
    return this.repository.findOne({
      where: { id, organization_id: organizationId, is_deleted: false },
      relations: ['shift', 'weekly_off', 'geo_fence'],
    });
  }

  async update(
    id: string,
    data: Partial<AttendanceRule>,
  ): Promise<AttendanceRule | null> {
    await this.repository.update(id, data);
    return this.repository.findOne({
      where: { id },
      relations: ['shift', 'weekly_off', 'geo_fence'],
    });
  }

  async softDelete(id: string, deletedBy?: string): Promise<void> {
    await this.repository.update(id, {
      is_deleted: true,
      status: Status.INACTIVE,
      deleted_at: new Date(),
      deleted_by: deletedBy,
    });
  }

  async countActiveByShiftId(shiftId: string): Promise<number> {
    return this.repository.count({
      where: {
        shift_id: shiftId,
        status: Status.ACTIVE,
        is_deleted: false,
      },
    });
  }

  async countActiveByWeeklyOffId(weeklyOffId: string): Promise<number> {
    return this.repository.count({
      where: {
        weekly_off_id: weeklyOffId,
        status: Status.ACTIVE,
        is_deleted: false,
      },
    });
  }
}
