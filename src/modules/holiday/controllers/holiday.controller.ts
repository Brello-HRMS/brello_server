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
import { HolidayService } from '../services/holiday.service';
import { CreateHolidayDto } from '../dto/create-holiday.dto';
import { UpdateHolidayDto } from '../dto/update-holiday.dto';
import { HolidayQueryDto } from '../dto/holiday-query.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AccessGuard } from '../../../core/guards/access.guard';
import { RequirePermission } from '../../../core/guards/require-permission.decorator';
import { LoggedInUser } from '../../../common/decorators/logged-in-user.decorator';
import type { LoggedInUser as LoggedInUserInterface } from '../../auth/interfaces/logged-in-user.interface';

@Controller('holidays')
@UseGuards(JwtAuthGuard, AccessGuard)
export class HolidayController {
  constructor(private readonly holidayService: HolidayService) {}

  @Post('calendars/:calendarId/holidays')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('HOLIDAY', 'create')
  create(
    @LoggedInUser() user: LoggedInUserInterface,
    @Param('calendarId', ParseUUIDPipe) calendarId: string,
    @Body() dto: CreateHolidayDto,
  ) {
    return this.holidayService.create(user, calendarId, dto);
  }

  @Get('calendars/:calendarId/holidays')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('HOLIDAY', 'view')
  findAll(
    @LoggedInUser() user: LoggedInUserInterface,
    @Param('calendarId', ParseUUIDPipe) calendarId: string,
    @Query() query: HolidayQueryDto,
  ) {
    return this.holidayService.findAll(user, calendarId, query);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('HOLIDAY', 'view')
  findOne(
    @LoggedInUser() user: LoggedInUserInterface,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.holidayService.findOne(user, id);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('HOLIDAY', 'update')
  update(
    @LoggedInUser() user: LoggedInUserInterface,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateHolidayDto,
  ) {
    return this.holidayService.update(user, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('HOLIDAY', 'delete')
  remove(
    @LoggedInUser() user: LoggedInUserInterface,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.holidayService.remove(user, id);
  }

  @Get('calendars/:calendarId/month-view')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('HOLIDAY', 'view')
  getMonthView(
    @LoggedInUser() user: LoggedInUserInterface,
    @Param('calendarId', ParseUUIDPipe) calendarId: string,
    @Query('month') month: number,
    @Query('year') year: number,
  ) {
    return this.holidayService.getMonthView(user, calendarId, month, year);
  }
}
