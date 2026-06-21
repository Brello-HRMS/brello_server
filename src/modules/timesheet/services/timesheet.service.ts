import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { LoggedInUser } from '../../auth/interfaces/logged-in-user.interface';
import { CreateTimesheetDto } from '../dto/create-timesheet.dto';
import { UpdateTimesheetDto } from '../dto/update-timesheet.dto';
import { TimesheetCalendarQueryDto } from '../dto/timesheet-calendar-query.dto';
import { TimesheetRepository } from '../repositories/timesheet.repository';
import { TimesheetSubmissionStatus } from '../enums/timesheet-submission-status.enum';
import {
  calcWorkedMinutes,
  formatMinutesToHours,
  getWeekBoundaries,
  isEndAfterStart,
  toIsoDate,
} from './timesheet-calc.util';

@Injectable()
export class TimesheetService {
  private readonly logger = new Logger(TimesheetService.name);

  constructor(private readonly timesheetRepository: TimesheetRepository) {}

  // ─── Create ────────────────────────────────────────────────────────────────

  async createEntry(user: LoggedInUser, dto: CreateTimesheetDto) {
    this.logger.log(
      `Creating timesheet entry for user ${user.userId} on project ${dto.project_id}`,
    );

    await this.guardProjectAssignment(user, dto.project_id);
    this.guardTimeRange(dto.start_time, dto.end_time);
    await this.guardDuplicate(
      user.organizationId,
      user.userId,
      dto.project_id,
      dto.entry_date,
      dto.start_time,
    );

    const workedMinutes = calcWorkedMinutes(dto.start_time, dto.end_time);

    const entry = await this.timesheetRepository.create({
      user_id: user.userId,
      project_id: dto.project_id,
      organization_id: user.organizationId,
      enterprise_id: user.enterpriseId,
      entry_date: dto.entry_date,
      start_time: dto.start_time,
      end_time: dto.end_time,
      worked_minutes: workedMinutes,
      task_description: dto.task_description,
      note: dto.note ?? null,
      submission_status: TimesheetSubmissionStatus.DRAFT,
      modified_by: user.userId,
    });

    return this.toEntryResponse(entry, workedMinutes);
  }

  // ─── Update ────────────────────────────────────────────────────────────────

  async updateEntry(
    user: LoggedInUser,
    entryId: string,
    dto: UpdateTimesheetDto,
  ) {
    this.logger.log(`Updating timesheet entry ${entryId} for user ${user.userId}`);

    const entry = await this.findOwnedEntryOrFail(entryId, user);

    // Resolve the effective values after the patch
    const effectiveProjectId = dto.project_id ?? entry.project_id;
    const effectiveDate = dto.entry_date ?? entry.entry_date;
    const effectiveStart = dto.start_time ?? entry.start_time;
    const effectiveEnd = dto.end_time ?? entry.end_time;

    if (dto.project_id && dto.project_id !== entry.project_id) {
      await this.guardProjectAssignment(user, dto.project_id);
    }

    this.guardTimeRange(effectiveStart, effectiveEnd);

    const hasKeyFieldChange =
      dto.project_id || dto.entry_date || dto.start_time;

    if (hasKeyFieldChange) {
      await this.guardDuplicate(
        user.organizationId,
        user.userId,
        effectiveProjectId,
        effectiveDate,
        effectiveStart,
        entryId,
      );
    }

    const workedMinutes = calcWorkedMinutes(effectiveStart, effectiveEnd);

    await this.timesheetRepository.update(entryId, {
      project_id: dto.project_id ?? entry.project_id,
      entry_date: dto.entry_date ?? entry.entry_date,
      start_time: dto.start_time ?? entry.start_time,
      end_time: dto.end_time ?? entry.end_time,
      worked_minutes: workedMinutes,
      task_description: dto.task_description ?? entry.task_description,
      note: dto.note !== undefined ? (dto.note ?? null) : entry.note,
      modified_by: user.userId,
      modified_at: new Date(),
    });

    return { success: true };
  }

  // ─── Delete ────────────────────────────────────────────────────────────────

  async deleteEntry(user: LoggedInUser, entryId: string) {
    this.logger.log(`Soft-deleting timesheet entry ${entryId} for user ${user.userId}`);

    await this.findOwnedEntryOrFail(entryId, user);
    await this.timesheetRepository.softDelete(entryId, user.userId);

    return { success: true };
  }

  // ─── Calendar ──────────────────────────────────────────────────────────────

  /**
   * Returns all timesheet entries for the logged-in user in a given month.
   * Grouped by entry_date for easy calendar rendering on the frontend.
   */
  async getCalendarEntries(
    user: LoggedInUser,
    query: TimesheetCalendarQueryDto,
  ) {
    const rows = await this.timesheetRepository.findForCalendar(
      user.organizationId,
      user.userId,
      query.year,
      query.month,
    );

    // Group by date so the frontend can map entries onto calendar slots
    const byDate: Record<string, typeof rows> = {};
    for (const row of rows) {
      const key = row.entry_date;
      if (!byDate[key]) byDate[key] = [];
      byDate[key].push(row);
    }

    const grouped = Object.entries(byDate).map(([date, entries]) => ({
      date,
      entries: entries.map((e) => ({
        id: e.id,
        project_id: e.project_id,
        project_name: e.project_name,
        start_time: e.start_time,
        end_time: e.end_time,
        worked_minutes: e.worked_minutes,
        worked_hours: formatMinutesToHours(e.worked_minutes),
        task_description: e.task_description,
        note: e.note,
        submission_status: e.submission_status,
      })),
    }));

    return { year: query.year, month: query.month, calendar: grouped };
  }

  // ─── Dashboard ─────────────────────────────────────────────────────────────

  /**
   * Returns all dashboard stats in a single response using parallel queries.
   * No sequential awaits — every query runs concurrently.
   */
  async getDashboard(user: LoggedInUser) {
    const now = new Date();
    const { weekStart, weekEnd } = getWeekBoundaries(now);
    const monthStart = toIsoDate(new Date(now.getFullYear(), now.getMonth(), 1));
    const monthEnd = toIsoDate(new Date(now.getFullYear(), now.getMonth() + 1, 0));

    const [
      projectCount,
      weeklyMinutes,
      monthlyMinutes,
      assignedProjects,
    ] = await Promise.all([
      this.timesheetRepository.countAssignedProjects(
        user.organizationId,
        user.userId,
      ),
      this.timesheetRepository.sumWorkedMinutesInRange(
        user.organizationId,
        user.userId,
        weekStart,
        weekEnd,
      ),
      this.timesheetRepository.sumWorkedMinutesInRange(
        user.organizationId,
        user.userId,
        monthStart,
        monthEnd,
      ),
      this.timesheetRepository.findAssignedProjects(
        user.organizationId,
        user.userId,
      ),
    ]);

    return {
      project_count: projectCount,
      hours_this_week: formatMinutesToHours(weeklyMinutes),
      hours_this_month: formatMinutesToHours(monthlyMinutes),
      assigned_projects: assignedProjects.map((p) => ({
        project_id: p.project_id,
        project_name: p.project_name,
      })),
    };
  }

  // ─── Assigned Projects (Dropdown) ──────────────────────────────────────────

  async getAssignedProjects(user: LoggedInUser) {
    const projects = await this.timesheetRepository.findAssignedProjects(
      user.organizationId,
      user.userId,
    );

    return projects.map((p) => ({
      project_id: p.project_id,
      project_name: p.project_name,
    }));
  }

  // ─── Guards ────────────────────────────────────────────────────────────────

  /**
   * Ensures the project is assigned to the user through project_team_mappings.
   * Throws ForbiddenException if not — never exposes whether the project exists.
   */
  private async guardProjectAssignment(
    user: LoggedInUser,
    projectId: string,
  ): Promise<void> {
    const isAssigned = await this.timesheetRepository.isUserAssignedToProject(
      user.userId,
      projectId,
      user.organizationId,
    );

    if (!isAssigned) {
      throw new ForbiddenException(
        'You are not assigned to this project. Timesheet entry rejected.',
      );
    }
  }

  /**
   * Validates that end_time is strictly after start_time.
   */
  private guardTimeRange(startTime: string, endTime: string): void {
    if (!isEndAfterStart(startTime, endTime)) {
      throw new BadRequestException(
        'end_time must be strictly after start_time',
      );
    }
  }

  /**
   * Checks for duplicate entries.
   * An optional excludeId skips the current record (used on update).
   */
  private async guardDuplicate(
    organizationId: string,
    userId: string,
    projectId: string,
    entryDate: string,
    startTime: string,
    excludeId?: string,
  ): Promise<void> {
    const isDuplicate = await this.timesheetRepository.findDuplicate(
      organizationId,
      userId,
      projectId,
      entryDate,
      startTime,
      excludeId,
    );

    if (isDuplicate) {
      throw new ConflictException(
        'A timesheet entry for this project, date, and start time already exists.',
      );
    }
  }

  /**
   * Loads an entry, verifies it exists, belongs to the org, and is owned by the user.
   */
  private async findOwnedEntryOrFail(entryId: string, user: LoggedInUser) {
    const entry = await this.timesheetRepository.findById(
      entryId,
      user.organizationId,
    );

    if (!entry) {
      throw new NotFoundException(`Timesheet entry "${entryId}" not found`);
    }

    if (entry.user_id !== user.userId) {
      throw new ForbiddenException(
        'You do not have permission to modify this timesheet entry',
      );
    }

    return entry;
  }

  // ─── Response Shaping ──────────────────────────────────────────────────────

  private toEntryResponse(
    entry: { id: string; submission_status: TimesheetSubmissionStatus },
    workedMinutes: number,
  ) {
    return {
      timesheet_id: entry.id,
      submission_status: entry.submission_status,
      worked_minutes: workedMinutes,
      worked_hours: formatMinutesToHours(workedMinutes),
    };
  }
}
