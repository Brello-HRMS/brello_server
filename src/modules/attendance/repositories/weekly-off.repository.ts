import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WeeklyOff } from '../entities/weekly-off.entity';
import { Status } from '../../../common/enums';
import { PaginationDto } from '../../../common/dto/pagination.dto';

@Injectable()
export class WeeklyOffRepository {
  constructor(
    @InjectRepository(WeeklyOff)
    private readonly repository: Repository<WeeklyOff>,
  ) {}

  async create(data: Partial<WeeklyOff>): Promise<WeeklyOff> {
    const weeklyOff = this.repository.create(data);
    return this.repository.save(weeklyOff);
  }

  async findAllByOrg(
    organizationId: string,
    pagination: PaginationDto,
  ): Promise<{ data: WeeklyOff[]; total: number }> {
    const { page = 1, limit = 20 } = pagination;
    const [data, total] = await this.repository.findAndCount({
      where: { organization_id: organizationId, is_deleted: false },
      order: { created_at: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total };
  }

  async findOneByOrg(id: string, organizationId: string): Promise<WeeklyOff | null> {
    return this.repository.findOne({
      where: { id, organization_id: organizationId, is_deleted: false },
    });
  }

  async update(id: string, data: Partial<WeeklyOff>): Promise<WeeklyOff | null> {
    await this.repository.update(id, data);
    return this.repository.findOne({ where: { id } });
  }

  async softDelete(id: string, deletedBy?: string): Promise<void> {
    await this.repository.update(id, {
      is_deleted: true,
      status: Status.INACTIVE,
      deleted_at: new Date(),
      deleted_by: deletedBy,
    });
  }
}
