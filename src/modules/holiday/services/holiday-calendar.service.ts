import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { HolidayCalendarRepository } from '../repositories/holiday-calendar.repository';
import { HolidayRepository } from '../repositories/holiday.repository';
import { CreateHolidayCalendarDto } from '../dto/create-holiday-calendar.dto';
import { UpdateHolidayCalendarDto } from '../dto/update-holiday-calendar.dto';
import { ListCalendarsDto } from '../dto/list-calendars.dto';
import { HolidayCalendar } from '../entities/holiday-calendar.entity';
import { Status } from '../../../common/enums';
import { LoggedInUser } from '../../auth/interfaces/logged-in-user.interface';
import { AuditContextService } from '../../audit/services/audit-context.service';

@Injectable()
export class HolidayCalendarService {
  private readonly logger = new Logger(HolidayCalendarService.name);

  constructor(
    private readonly calendarRepo: HolidayCalendarRepository,
    private readonly holidayRepo: HolidayRepository,
    private readonly auditContext: AuditContextService,
  ) {}

  async create(user: LoggedInUser, dto: CreateHolidayCalendarDto): Promise<HolidayCalendar> {
    this.logger.log(`User ${user.userId} is creating holiday calendar: ${dto.name}`);

    const calendar = await this.calendarRepo.create({
      name: dto.name,
      year: dto.year,
      organization_id: user.organizationId,
      enterprise_id: user.enterpriseId,
      status: Status.PENDING,
      modified_by: user.userId,
    });

    if (dto.clone_from_calendar_id) {
      await this.cloneHolidays(user, dto.clone_from_calendar_id, calendar.id);
    }

    return calendar;
  }

  private async cloneHolidays(user: LoggedInUser, sourceId: string, targetId: string): Promise<void> {
    const sourceCalendar = await this.calendarRepo.findOneByOrg(sourceId, user.organizationId);
    if (!sourceCalendar) {
      throw new NotFoundException(`Source calendar ${sourceId} not found`);
    }

    const holidays = await this.holidayRepo.findByCalendar(sourceId);
    for (const h of holidays) {
      await this.holidayRepo.create({
        calendar_id: targetId,
        name: h.name,
        date: h.date,
        type: h.type,
        color: h.color,
        description: h.description,
        organization_id: user.organizationId,
        enterprise_id: user.enterpriseId,
        modified_by: user.userId,
      });
    }
  }

  async findAll(user: LoggedInUser, query: ListCalendarsDto): Promise<HolidayCalendar[]> {
    return this.calendarRepo.findAllByOrg(user.organizationId, query);
  }

  async findOne(user: LoggedInUser, id: string): Promise<HolidayCalendar> {
    const calendar = await this.calendarRepo.findOneByOrg(id, user.organizationId);
    if (!calendar) {
      throw new NotFoundException(`Holiday calendar ${id} not found`);
    }
    return calendar;
  }

  async update(user: LoggedInUser, id: string, dto: UpdateHolidayCalendarDto): Promise<HolidayCalendar> {
    const calendar = await this.findOne(user, id);
    this.auditContext.setPreValue(calendar as unknown as Record<string, unknown>);
    return (await this.calendarRepo.update(id, { ...dto, modified_by: user.userId }))!;
  }

  async activate(user: LoggedInUser, id: string): Promise<void> {
    const calendar = await this.findOne(user, id);
    
    // Deactivate others in same year
    await this.calendarRepo.deactivateOthersInYear(user.organizationId, calendar.year, id);
    
    // Set this one to ACTIVE
    await this.calendarRepo.update(id, { 
      status: Status.ACTIVE,
      modified_by: user.userId 
    });
    
    this.logger.log(`Calendar ${id} activated for year ${calendar.year} by ${user.userId}`);
  }

  async deactivate(user: LoggedInUser, id: string): Promise<void> {
    await this.findOne(user, id);
    await this.calendarRepo.update(id, { 
      status: Status.INACTIVE,
      modified_by: user.userId 
    });
  }

  async remove(user: LoggedInUser, id: string): Promise<void> {
    const calendar = await this.findOne(user, id);
    if (calendar.status === Status.ACTIVE) {
      throw new BadRequestException('Cannot delete an active calendar');
    }
    this.auditContext.setPreValue(calendar as unknown as Record<string, unknown>);
    await this.calendarRepo.softDelete(id, user.userId);
    await this.holidayRepo.softDeleteByCalendar(id, user.userId);
  }

  async clone(user: LoggedInUser, sourceId: string, dto: { name: string; year: number; set_active?: boolean }): Promise<HolidayCalendar> {
    const source = await this.findOne(user, sourceId);
    const newCalendar = await this.calendarRepo.create({
      name: dto.name,
      year: dto.year,
      organization_id: user.organizationId,
      enterprise_id: user.enterpriseId,
      status: Status.PENDING,
      modified_by: user.userId,
    });

    await this.cloneHolidays(user, sourceId, newCalendar.id);

    if (dto.set_active) {
      await this.activate(user, newCalendar.id);
    }

    return newCalendar;
  }
}
