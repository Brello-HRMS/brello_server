import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { HolidayRepository } from '../repositories/holiday.repository';
import { HolidayCalendarRepository } from '../repositories/holiday-calendar.repository';
import { CreateHolidayDto } from '../dto/create-holiday.dto';
import { UpdateHolidayDto } from '../dto/update-holiday.dto';
import { HolidayQueryDto } from '../dto/holiday-query.dto';
import { Holiday } from '../entities/holiday.entity';
import { Status } from '../../../common/enums';
import { LoggedInUser } from '../../auth/interfaces/logged-in-user.interface';

@Injectable()
export class HolidayService {
  private readonly logger = new Logger(HolidayService.name);

  constructor(
    private readonly holidayRepo: HolidayRepository,
    private readonly calendarRepo: HolidayCalendarRepository,
  ) {}

  async create(user: LoggedInUser, calendarId: string, dto: CreateHolidayDto): Promise<Holiday> {
    const calendar = await this.calendarRepo.findOneByOrg(calendarId, user.organizationId);
    if (!calendar) {
      throw new NotFoundException(`Calendar ${calendarId} not found`);
    }

    return this.holidayRepo.create({
      ...dto,
      calendar_id: calendarId,
      organization_id: user.organizationId,
      enterprise_id: user.enterpriseId,
      modified_by: user.userId,
    });
  }

  async findAll(user: LoggedInUser, calendarId: string, query: HolidayQueryDto): Promise<Holiday[]> {
    const calendar = await this.calendarRepo.findOneByOrg(calendarId, user.organizationId);
    if (!calendar) {
      throw new NotFoundException(`Calendar ${calendarId} not found`);
    }
    return this.holidayRepo.findByCalendar(calendarId, query);
  }

  async findOne(user: LoggedInUser, id: string): Promise<Holiday> {
    const holiday = await this.holidayRepo.findOne(id);
    if (!holiday || holiday.organization_id !== user.organizationId) {
      throw new NotFoundException(`Holiday ${id} not found`);
    }
    return holiday;
  }

  async update(user: LoggedInUser, id: string, dto: UpdateHolidayDto): Promise<Holiday> {
    const holiday = await this.findOne(user, id);
    
    // Constraint: Date locked after activation
    if (holiday.calendar.status === Status.ACTIVE && dto.date && dto.date !== holiday.date) {
      throw new BadRequestException('Cannot change holiday date in an active calendar');
    }

    return (await this.holidayRepo.update(id, { ...dto, modified_by: user.userId }))!;
  }

  async remove(user: LoggedInUser, id: string): Promise<void> {
    await this.findOne(user, id);
    await this.holidayRepo.softDelete(id);
  }

  async getMonthView(user: LoggedInUser, calendarId: string, month: number, year: number): Promise<any> {
    const holidays = await this.holidayRepo.findByCalendar(calendarId, { month });
    
    // Group by date
    const days = holidays.map(h => ({
      date: h.date,
      holidays: [{
        id: h.id,
        name: h.name,
        type: h.type,
        color: h.color
      }]
    }));

    return {
      month,
      year,
      days
    };
  }

  async getEmployeeHolidays(user: LoggedInUser, year: number): Promise<any> {
    const holidays = await this.holidayRepo.findByOrgAndYear(user.organizationId, year);
    
    const now = new Date();
    const upcoming = holidays.filter(h => new Date(h.date) >= now);

    const format = (h: Holiday) => ({
      name: h.name,
      date: h.date,
      day: new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(new Date(h.date)),
      type: h.type
    });

    return {
      upcoming: upcoming.map(format),
      all: holidays.map(format)
    };
  }
}
