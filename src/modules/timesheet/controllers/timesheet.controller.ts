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
import { LoggedInUser } from '../../../common/decorators/logged-in-user.decorator';
import type { LoggedInUser as LoggedInUserInterface } from '../../auth/interfaces/logged-in-user.interface';
import { TimesheetService } from '../services/timesheet.service';
import { CreateTimesheetDto } from '../dto/create-timesheet.dto';
import { UpdateTimesheetDto } from '../dto/update-timesheet.dto';
import { TimesheetCalendarQueryDto } from '../dto/timesheet-calendar-query.dto';

@Controller('timesheet')
@UseGuards(JwtAuthGuard)
export class TimesheetController {
  constructor(private readonly timesheetService: TimesheetService) {}

  // ─── Dashboard ──────────────────────────────────────────────────────────────

  /**
   * GET /timesheet/dashboard
   * Returns aggregated stats: project count, weekly hours, monthly hours,
   * and the list of assigned projects for the logged-in user.
   */
  @Get('dashboard')
  getDashboard(@LoggedInUser() user: LoggedInUserInterface) {
    return this.timesheetService.getDashboard(user);
  }

  // ─── Assigned Projects Dropdown ─────────────────────────────────────────────

  /**
   * GET /timesheet/projects
   * Returns the list of projects assigned to the logged-in user.
   * Used to populate the project dropdown in the timesheet form.
   */
  @Get('projects')
  getAssignedProjects(@LoggedInUser() user: LoggedInUserInterface) {
    return this.timesheetService.getAssignedProjects(user);
  }

  // ─── Calendar ───────────────────────────────────────────────────────────────

  /**
   * GET /timesheet/calendar?year=2025&month=6
   * Returns all entries for the given month grouped by entry_date.
   */
  @Get('calendar')
  getCalendarEntries(
    @LoggedInUser() user: LoggedInUserInterface,
    @Query() query: TimesheetCalendarQueryDto,
  ) {
    return this.timesheetService.getCalendarEntries(user, query);
  }

  // ─── Create ─────────────────────────────────────────────────────────────────

  /**
   * POST /timesheet
   * Creates a new timesheet entry. Validates project assignment, time range,
   * and duplicate rules before persisting.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  createEntry(
    @LoggedInUser() user: LoggedInUserInterface,
    @Body() dto: CreateTimesheetDto,
  ) {
    return this.timesheetService.createEntry(user, dto);
  }

  // ─── Update ─────────────────────────────────────────────────────────────────

  /**
   * PATCH /timesheet/:id
   * Partially updates a timesheet entry. Ownership is verified before any change.
   */
  @Patch(':id')
  updateEntry(
    @LoggedInUser() user: LoggedInUserInterface,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTimesheetDto,
  ) {
    return this.timesheetService.updateEntry(user, id, dto);
  }

  // ─── Delete ─────────────────────────────────────────────────────────────────

  /**
   * DELETE /timesheet/:id
   * Soft-deletes a timesheet entry. Ownership is verified before deletion.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  deleteEntry(
    @LoggedInUser() user: LoggedInUserInterface,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.timesheetService.deleteEntry(user, id);
  }
}
