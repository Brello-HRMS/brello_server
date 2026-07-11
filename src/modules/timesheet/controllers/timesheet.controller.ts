import { RestrictedOnExpiry } from '../../billing/decorators/restricted-on-expiry.decorator';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AccessGuard } from '../../../core/guards/access.guard';
import { LoggedInUser } from '../../../common/decorators/logged-in-user.decorator';
import type { LoggedInUser as LoggedInUserInterface } from '../../auth/interfaces/logged-in-user.interface';
import { TimesheetService } from '../services/timesheet.service';
import { CreateTimesheetDto } from '../dto/create-timesheet.dto';
import { UpdateTimesheetDto } from '../dto/update-timesheet.dto';
import { TimesheetCalendarQueryDto } from '../dto/timesheet-calendar-query.dto';
import { RequirePermission } from 'src/core/guards/require-permission.decorator';

@Controller('timesheet')
@RestrictedOnExpiry()
@UseGuards(JwtAuthGuard, AccessGuard)
export class TimesheetController {
  constructor(private readonly timesheetService: TimesheetService) {}

  // ─── Dashboard ──────────────────────────────────────────────────────────────

  @Get('dashboard')
  @RequirePermission('PROJECT_TIMESHEET', 'view')
  getDashboard(@LoggedInUser() user: LoggedInUserInterface) {
    return this.timesheetService.getDashboard(user);
  }

  // ─── Assigned Projects Dropdown ─────────────────────────────────────────────

  @Get('projects')
  @RequirePermission('PROJECT_TIMESHEET', 'view')
  getAssignedProjects(@LoggedInUser() user: LoggedInUserInterface) {
    return this.timesheetService.getAssignedProjects(user);
  }

  // ─── Calendar ───────────────────────────────────────────────────────────────

  @Get('calendar')
  @RequirePermission('PROJECT_TIMESHEET', 'view')
  getCalendarEntries(
    @LoggedInUser() user: LoggedInUserInterface,
    @Query() query: TimesheetCalendarQueryDto,
  ) {
    return this.timesheetService.getCalendarEntries(user, query);
  }

  // ─── Create ─────────────────────────────────────────────────────────────────

  @Post()
  @RequirePermission('PROJECT_TIMESHEET', 'create')
  @HttpCode(HttpStatus.CREATED)
  createEntry(
    @LoggedInUser() user: LoggedInUserInterface,
    @Body() dto: CreateTimesheetDto,
  ) {
    return this.timesheetService.createEntry(user, dto);
  }

  // ─── Update ─────────────────────────────────────────────────────────────────

  @Patch(':id')
  @RequirePermission('PROJECT_TIMESHEET', 'update')
  updateEntry(
    @LoggedInUser() user: LoggedInUserInterface,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTimesheetDto,
  ) {
    return this.timesheetService.updateEntry(user, id, dto);
  }

  // ─── Delete ─────────────────────────────────────────────────────────────────

  @Delete(':id')
  @RequirePermission('PROJECT_TIMESHEET', 'delete')
  @HttpCode(HttpStatus.OK)
  deleteEntry(
    @LoggedInUser() user: LoggedInUserInterface,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.timesheetService.deleteEntry(user, id);
  }
}
