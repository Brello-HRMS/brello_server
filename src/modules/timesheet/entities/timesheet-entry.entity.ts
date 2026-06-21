import { Entity, Column, Index, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { TimesheetSubmissionStatus } from '../enums/timesheet-submission-status.enum';
import { User } from '../../user/entities/user.entity';
import { Project } from '../../project/entities/project.entity';

/**
 * TimesheetEntry Entity
 *
 * Represents a single time-logged block of work by an employee against
 * a project on a specific date.
 *
 * Duplicate prevention is enforced at DB level:
 * UNIQUE (organization_id, user_id, project_id, entry_date, start_time)
 *
 * Soft delete is controlled by the `is_deleted` flag (not the BaseEntity
 * `status` field) — consistent with the attendance module pattern.
 *
 * The `submission_status` column is intentionally present from day one
 * to support the future approval workflow without any schema migration.
 */
@Entity('timesheet_entries')
@Unique('uq_timesheet_entry', [
  'organization_id',
  'user_id',
  'project_id',
  'entry_date',
  'start_time',
])
@Index('idx_timesheet_user_date', ['organization_id', 'user_id', 'entry_date'])
@Index('idx_timesheet_project', ['organization_id', 'project_id', 'entry_date'])
export class TimesheetEntry extends BaseEntity {
  // ─── Who logged it ─────────────────────────────────────────────────────────

  @Column({ type: 'uuid' })
  user_id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  // ─── Which project ─────────────────────────────────────────────────────────

  @Column({ type: 'uuid' })
  project_id: string;

  @ManyToOne(() => Project)
  @JoinColumn({ name: 'project_id' })
  project: Project;

  // ─── When ──────────────────────────────────────────────────────────────────

  /** The calendar date the work was performed (YYYY-MM-DD) */
  @Column({ type: 'date' })
  entry_date: string;

  /** 24-hour HH:MM format — e.g. "09:00" */
  @Column({ type: 'varchar', length: 5 })
  start_time: string;

  /** 24-hour HH:MM format — e.g. "17:30" */
  @Column({ type: 'varchar', length: 5 })
  end_time: string;

  /** Computed field: (end_time − start_time) in minutes */
  @Column({ type: 'int', default: 0 })
  worked_minutes: number;

  // ─── What ──────────────────────────────────────────────────────────────────

  @Column({ type: 'text' })
  task_description: string;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  @Column({
    type: 'enum',
    enum: TimesheetSubmissionStatus,
    default: TimesheetSubmissionStatus.DRAFT,
  })
  submission_status: TimesheetSubmissionStatus;

  /** Soft delete flag — consistent with attendance_records pattern */
  @Column({ type: 'boolean', default: false })
  is_deleted: boolean;
}
