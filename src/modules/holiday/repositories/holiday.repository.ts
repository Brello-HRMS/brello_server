import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Holiday } from '../entities/holiday.entity';
import { HolidayType } from '../enums/holiday-type.enum';

@Injectable()
export class HolidayRepository {
  constructor(
    @InjectRepository(Holiday)
    private readonly repository: Repository<Holiday>,
  ) {}

  async create(data: Partial<Holiday>): Promise<Holiday> {
    const holiday = this.repository.create(data);
    return this.repository.save(holiday);
  }

  async findByCalendar(
    calendarId: string,
    filters: { type?: HolidayType; month?: number; sort?: string } = {},
  ): Promise<Holiday[]> {
    const { type, month, sort } = filters;
    const query = this.repository
      .createQueryBuilder('holiday')
      .where('holiday.calendar_id = :calendarId', { calendarId })
      .andWhere('holiday.is_deleted = :isDeleted', { isDeleted: false });

    if (type) {
      query.andWhere('holiday.type = :type', { type });
    }

    if (month) {
      // month is 1-12. PostgreSQL extract month is 1-12.
      query.andWhere('EXTRACT(MONTH FROM holiday.date) = :month', { month });
    }

    if (sort === 'date_desc') {
      query.orderBy('holiday.date', 'DESC');
    } else {
      query.orderBy('holiday.date', 'ASC');
    }

    return query.getMany();
  }

  async findOne(id: string): Promise<Holiday | null> {
    return this.repository.findOne({
      where: { id, is_deleted: false },
      relations: ['calendar'],
    });
  }

  async update(id: string, data: Partial<Holiday>): Promise<Holiday | null> {
    await this.repository.update(id, data);
    return this.repository.findOne({ where: { id } });
  }

  async softDelete(id: string): Promise<void> {
    await this.repository.update(id, { is_deleted: true });
  }

  async findByOrgAndYear(
    organizationId: string,
    year: number,
  ): Promise<Holiday[]> {
    return this.repository
      .createQueryBuilder('holiday')
      .innerJoin('holiday.calendar', 'calendar')
      .where('holiday.organization_id = :organizationId', { organizationId })
      .andWhere('calendar.year = :year', { year })
      .andWhere('calendar.status = :status', { status: 'ACTIVE' })
      .andWhere('holiday.is_deleted = :isDeleted', { isDeleted: false })
      .orderBy('holiday.date', 'ASC')
      .getMany();
  }
}
