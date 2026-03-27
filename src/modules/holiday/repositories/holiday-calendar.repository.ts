import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HolidayCalendar } from '../entities/holiday-calendar.entity';
import { Status } from '../../../common/enums';

@Injectable()
export class HolidayCalendarRepository {
  constructor(
    @InjectRepository(HolidayCalendar)
    private readonly repository: Repository<HolidayCalendar>,
  ) {}

  async create(data: Partial<HolidayCalendar>): Promise<HolidayCalendar> {
    const calendar = this.repository.create(data);
    return this.repository.save(calendar);
  }

  async findAllByOrg(
    organizationId: string,
    filters: { year?: number; status?: Status } = {},
  ): Promise<HolidayCalendar[]> {
    const { year, status } = filters;
    const query = this.repository
      .createQueryBuilder('calendar')
      .where('calendar.organization_id = :organizationId', { organizationId })
      .andWhere('calendar.is_deleted = :isDeleted', { isDeleted: false });

    if (year) {
      query.andWhere('calendar.year = :year', { year });
    }

    if (status) {
      query.andWhere('calendar.status = :status', { status });
    }

    query.orderBy('calendar.year', 'DESC').addOrderBy('calendar.name', 'ASC');

    return query.getMany();
  }

  async findOneByOrg(
    id: string,
    organizationId: string,
  ): Promise<HolidayCalendar | null> {
    return this.repository.findOne({
      where: {
        id,
        organization_id: organizationId,
        is_deleted: false,
      },
      relations: ['holidays'],
    });
  }

  async update(
    id: string,
    data: Partial<HolidayCalendar>,
  ): Promise<HolidayCalendar | null> {
    await this.repository.update(id, data);
    return this.repository.findOne({ where: { id } });
  }

  async deactivateOthersInYear(
    organizationId: string,
    year: number,
    excludeId: string,
  ): Promise<void> {
    await this.repository
      .createQueryBuilder()
      .update(HolidayCalendar)
      .set({ status: Status.INACTIVE })
      .where('organization_id = :organizationId', { organizationId })
      .andWhere('year = :year', { year })
      .andWhere('id != :excludeId', { excludeId })
      .andWhere('is_deleted = :isDeleted', { isDeleted: false })
      .execute();
  }

  async softDelete(id: string): Promise<void> {
    await this.repository.update(id, {
      is_deleted: true,
      status: Status.INACTIVE,
    });
  }
}
