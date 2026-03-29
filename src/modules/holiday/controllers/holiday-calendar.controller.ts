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

@Controller('holidays/calendars')
@UseGuards(JwtAuthGuard, AccessGuard)
export class HolidayCalendarController {
  constructor(private readonly calendarService: HolidayCalendarService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('HOLIDAY_MGMT', 'create')
  create(
    @LoggedInUser() user: LoggedInUserInterface,
    @Body() dto: CreateHolidayCalendarDto,
  ) {
    return this.calendarService.create(user, dto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @RequirePermission('HOLIDAY_MGMT', 'view')
  findAll(
    @LoggedInUser() user: LoggedInUserInterface,
    @Query() query: ListCalendarsDto,
  ) {
    return this.calendarService.findAll(user, query);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('HOLIDAY_MGMT', 'view')
  findOne(
    @LoggedInUser() user: LoggedInUserInterface,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.calendarService.findOne(user, id);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('HOLIDAY_MGMT', 'update')
  update(
    @LoggedInUser() user: LoggedInUserInterface,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateHolidayCalendarDto,
  ) {
    return this.calendarService.update(user, id, dto);
  }

  @Post(':id/activate')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('HOLIDAY_MGMT', 'activate')
  activate(
    @LoggedInUser() user: LoggedInUserInterface,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.calendarService.activate(user, id);
  }

  @Post(':id/deactivate')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('HOLIDAY_MGMT', 'activate')
  deactivate(
    @LoggedInUser() user: LoggedInUserInterface,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.calendarService.deactivate(user, id);
  }

  @Post(':id/clone')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('HOLIDAY_MGMT', 'clone')
  clone(
    @LoggedInUser() user: LoggedInUserInterface,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: { name: string; year: number; set_active?: boolean },
  ) {
    return this.calendarService.clone(user, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('HOLIDAY_MGMT', 'delete')
  remove(
    @LoggedInUser() user: LoggedInUserInterface,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.calendarService.remove(user, id);
  }
}
