import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Shift } from '../entities/shift.entity';
import { Status } from '../../../common/enums';
import { PaginationDto } from '../../../common/dto/pagination.dto';

@Injectable()
export class ShiftRepository {
  constructor(
    @InjectRepository(Shift)
    private readonly repository: Repository<Shift>,
  ) {}

  async create(data: Partial<Shift>): Promise<Shift> {
    const shift = this.repository.create(data);
    return this.repository.save(shift);
  }

  async findAllByOrg(
    organizationId: string,
    pagination: PaginationDto,
  ): Promise<{ data: Shift[]; total: number }> {
    const { page = 1, limit = 20 } = pagination;
    const [data, total] = await this.repository.findAndCount({
      where: { organization_id: organizationId, is_deleted: false },
      order: { created_at: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total };
  }

  async findOneByOrg(id: string, organizationId: string): Promise<Shift | null> {
    return this.repository.findOne({
      where: { id, organization_id: organizationId, is_deleted: false },
    });
  }

  async update(id: string, data: Partial<Shift>): Promise<Shift | null> {
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
