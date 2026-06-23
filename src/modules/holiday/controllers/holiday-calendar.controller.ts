import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  UseGuards,
  Query,
} from '@nestjs/common';
import { HolidayCalendarService } from '../services/holiday-calendar.service';
import { CreateHolidayCalendarDto } from '../dto/create-holiday-calendar.dto';
import { UpdateHolidayCalendarDto } from '../dto/update-holiday-calendar.dto';
import { ListCalendarsDto } from '../dto/list-calendars.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AccessGuard } from '../../../core/guards/access.guard';
import { RequirePermission } from '../../../core/guards/require-permission.decorator';
import { LoggedInUser } from '../../../common/decorators/logged-in-user.decorator';
import type { LoggedInUser as LoggedInUserInterface } from '../../auth/interfaces/logged-in-user.interface';
import { AuditLog } from '../../audit/decorators/audit-log.decorator';
import { AuditLogModule } from '../../audit/enums/audit-log-module.enum';
import { AuditAction } from '../../audit/enums/audit-action.enum';

@Controller('holidays/calendars')
@UseGuards(JwtAuthGuard, AccessGuard)
export class HolidayCalendarController {
  constructor(private readonly calendarService: HolidayCalendarService) {}

  @AuditLog(AuditLogModule.HOLIDAY, AuditAction.CREATE, 'holiday_calendar')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('LEAVE_HOLIDAYS', 'create')
  create(
    @LoggedInUser() user: LoggedInUserInterface,
    @Body() dto: CreateHolidayCalendarDto,
  ) {
    return this.calendarService.create(user, dto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @RequirePermission('LEAVE_HOLIDAYS', 'view')
  findAll(
    @LoggedInUser() user: LoggedInUserInterface,
    @Query() query: ListCalendarsDto,
  ) {
    return this.calendarService.findAll(user, query);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('LEAVE_HOLIDAYS', 'view')
  findOne(
    @LoggedInUser() user: LoggedInUserInterface,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.calendarService.findOne(user, id);
  }

  @AuditLog(AuditLogModule.HOLIDAY, AuditAction.UPDATE, 'holiday_calendar')
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('LEAVE_HOLIDAYS', 'update')
  update(
    @LoggedInUser() user: LoggedInUserInterface,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateHolidayCalendarDto,
  ) {
    return this.calendarService.update(user, id, dto);
  }

  @AuditLog(AuditLogModule.HOLIDAY, AuditAction.ACTIVATE, 'holiday_calendar')
  @Post(':id/activate')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('LEAVE_HOLIDAYS', 'activate')
  activate(
    @LoggedInUser() user: LoggedInUserInterface,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.calendarService.activate(user, id);
  }

  @AuditLog(AuditLogModule.HOLIDAY, AuditAction.DEACTIVATE, 'holiday_calendar')
  @Post(':id/deactivate')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('LEAVE_HOLIDAYS', 'activate')
  deactivate(
    @LoggedInUser() user: LoggedInUserInterface,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.calendarService.deactivate(user, id);
  }

  @AuditLog(AuditLogModule.HOLIDAY, AuditAction.CREATE, 'holiday_calendar')
  @Post(':id/clone')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('LEAVE_HOLIDAYS', 'clone')
  clone(
    @LoggedInUser() user: LoggedInUserInterface,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: { name: string; year: number; set_active?: boolean },
  ) {
    return this.calendarService.clone(user, id, dto);
  }

  @AuditLog(AuditLogModule.HOLIDAY, AuditAction.DELETE, 'holiday_calendar')
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('LEAVE_HOLIDAYS', 'delete')
  remove(
    @LoggedInUser() user: LoggedInUserInterface,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.calendarService.remove(user, id);
  }
}
