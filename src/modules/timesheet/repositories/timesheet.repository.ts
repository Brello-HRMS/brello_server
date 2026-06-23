import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TimesheetEntry } from '../entities/timesheet-entry.entity';
import { ProjectTeam } from '../../project/entities/project-team.entity';

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface CalendarEntryRow {
  id: string;
  entry_date: string;
  start_time: string;
  end_time: string;
  worked_minutes: number;
  task_description: string;
  note: string | null;
  submission_status: string;
  project_id: string;
  project_name: string | null;
}

export interface AssignedProjectRow {
  project_id: string;
  project_name: string;
}

// ─── Repository ──────────────────────────────────────────────────────────────

@Injectable()
export class TimesheetRepository {
  constructor(
    @InjectRepository(TimesheetEntry)
    private readonly timesheetRepo: Repository<TimesheetEntry>,

    @InjectRepository(ProjectTeam)
    private readonly projectTeamRepo: Repository<ProjectTeam>,
  ) {}

  // ─── Writes ──────────────────────────────────────────────────────────────

  async create(data: Partial<TimesheetEntry>): Promise<TimesheetEntry> {
    return this.timesheetRepo.save(this.timesheetRepo.create(data));
  }

  async update(id: string, data: Partial<TimesheetEntry>): Promise<void> {
    await this.timesheetRepo.update(id, data);
  }

  async softDelete(id: string, deletedBy: string): Promise<void> {
    await this.timesheetRepo.update(id, {
      is_deleted: true,
      deleted_at: new Date(),
      deleted_by: deletedBy,
    });
  }

  // ─── Single Entry Lookups ────────────────────────────────────────────────

  async findById(
    id: string,
    organizationId: string,
  ): Promise<TimesheetEntry | null> {
    return this.timesheetRepo.findOne({
      where: { id, organization_id: organizationId, is_deleted: false },
    });
  }

  /**
   * Checks whether a conflicting entry already exists for the same
   * user + project + date + start_time combination.
   * An optional excludeId is passed during updates to ignore the current record.
   */
  async findDuplicate(
    organizationId: string,
    userId: string,
    projectId: string,
    entryDate: string,
    startTime: string,
    excludeId?: string,
  ): Promise<boolean> {
    const qb = this.timesheetRepo
      .createQueryBuilder('t')
      .select('t.id')
      .where('t.organization_id = :orgId', { orgId: organizationId })
      .andWhere('t.user_id = :userId', { userId })
      .andWhere('t.project_id = :projectId', { projectId })
      .andWhere('t.entry_date = :entryDate', { entryDate })
      .andWhere('t.start_time = :startTime', { startTime })
      .andWhere('t.is_deleted = false');

    if (excludeId) {
      qb.andWhere('t.id != :excludeId', { excludeId });
    }

    const count = await qb.getCount();
    return count > 0;
  }

  // ─── Project Assignment Validation ───────────────────────────────────────

  /**
   * Confirms the user is a member of the given project via project_team_mappings.
   * This is the single source of truth for project assignment checks.
   */
  async isUserAssignedToProject(
    userId: string,
    projectId: string,
    organizationId: string,
  ): Promise<boolean> {
    const count = await this.projectTeamRepo
      .createQueryBuilder('ptm')
      .innerJoin('ptm.project', 'p')
      .where('ptm.user_id = :userId', { userId })
      .andWhere('ptm.project_id = :projectId', { projectId })
      .andWhere('p.organization_id = :orgId', { orgId: organizationId })
      .getCount();

    return count > 0;
  }

  // ─── Calendar View ───────────────────────────────────────────────────────

  /**
   * Fetches all timesheet entries for a specific user and month.
   * Joins project name for calendar slot display.
   * Result is ordered by entry_date, then start_time for deterministic rendering.
   */
  async findForCalendar(
    organizationId: string,
    userId: string,
    year: number,
    month: number,
  ): Promise<CalendarEntryRow[]> {
    const raw = await this.timesheetRepo
      .createQueryBuilder('t')
      .select([
        't.id                AS id',
        't.entry_date        AS entry_date',
        't.start_time        AS start_time',
        't.end_time          AS end_time',
        't.worked_minutes    AS worked_minutes',
        't.task_description  AS task_description',
        't.note              AS note',
        't.submission_status AS submission_status',
        't.project_id        AS project_id',
        'p.name              AS project_name',
      ])
      .leftJoin('projects', 'p', 'p.id = t.project_id')
      .where('t.organization_id = :orgId', { orgId: organizationId })
      .andWhere('t.user_id = :userId', { userId })
      .andWhere('EXTRACT(YEAR  FROM t.entry_date::date) = :year', { year })
      .andWhere('EXTRACT(MONTH FROM t.entry_date::date) = :month', { month })
      .andWhere('t.is_deleted = false')
      .orderBy('t.entry_date', 'ASC')
      .addOrderBy('t.start_time', 'ASC')
      .getRawMany<CalendarEntryRow>();

    return raw;
  }

  // ─── Dashboard Aggregations ──────────────────────────────────────────────

  /**
   * Sums worked_minutes within a date range (used for weekly/monthly hours).
   */
  async sumWorkedMinutesInRange(
    organizationId: string,
    userId: string,
    fromDate: string,
    toDate: string,
  ): Promise<number> {
    const raw = await this.timesheetRepo
      .createQueryBuilder('t')
      .select('COALESCE(SUM(t.worked_minutes), 0)', 'total')
      .where('t.organization_id = :orgId', { orgId: organizationId })
      .andWhere('t.user_id = :userId', { userId })
      .andWhere('t.entry_date >= :fromDate', { fromDate })
      .andWhere('t.entry_date <= :toDate', { toDate })
      .andWhere('t.is_deleted = false')
      .getRawOne<{ total: string }>();

    return Number(raw?.total ?? 0);
  }

  /**
   * Counts the distinct projects assigned to the user via project_team_mappings.
   */
  async countAssignedProjects(
    organizationId: string,
    userId: string,
  ): Promise<number> {
    return this.projectTeamRepo
      .createQueryBuilder('ptm')
      .innerJoin('ptm.project', 'p')
      .where('ptm.user_id = :userId', { userId })
      .andWhere('p.organization_id = :orgId', { orgId: organizationId })
      .getCount();
  }

  /**
   * Returns the list of projects assigned to the user — used for the
   * dashboard project list and the form dropdown.
   */
  async findAssignedProjects(
    organizationId: string,
    userId: string,
  ): Promise<AssignedProjectRow[]> {
    const raw = await this.projectTeamRepo
      .createQueryBuilder('ptm')
      .select([
        'p.id   AS project_id',
        'p.name AS project_name',
      ])
      .innerJoin('ptm.project', 'p')
      .where('ptm.user_id = :userId', { userId })
      .andWhere('p.organization_id = :orgId', { orgId: organizationId })
      .orderBy('p.name', 'ASC')
      .getRawMany<AssignedProjectRow>();

    return raw;
  }
}
