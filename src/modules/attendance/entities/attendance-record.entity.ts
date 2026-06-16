import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { AttendanceStatus } from '../enums/attendance-status.enum';
import { AttendanceMode } from '../enums/attendance-mode.enum';
import { AttendanceSource } from '../enums/attendance-source.enum';

@Entity('attendance_records')
@Index(['organization_id', 'employee_id', 'date'], { unique: true })
@Index(['organization_id', 'date'])
@Index(['organization_id', 'attendance_status', 'date'])
export class AttendanceRecord extends BaseEntity {
  @Column({ type: 'uuid' })
  employee_id: string;

  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'uuid', nullable: true })
  shift_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  rule_id: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  first_check_in_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  last_check_out_at: Date | null;

  @Column({ type: 'int', default: 0 })
  worked_minutes: number;

  @Column({ type: 'int', default: 0 })
  overtime_minutes: number;

  @Column({ type: 'int', nullable: true })
  late_minutes: number | null;

  @Column({ type: 'boolean', default: false })
  is_late: boolean;

  @Column({ type: 'boolean', default: false })
  is_half_day: boolean;

  @Column({ type: 'boolean', default: false })
  is_overtime: boolean;

  @Column({ type: 'enum', enum: AttendanceStatus })
  attendance_status: AttendanceStatus;

  /** True when this day's session was closed by the auto-checkout engine. */
  @Column({ type: 'boolean', default: false })
  has_auto_checkout: boolean;

  /**
   * Correction-request lifecycle for an auto-checkout record.
   * NULL | 'PENDING' | 'APPROVED' | 'REJECTED' | 'CLOSED' (window expired).
   */
  @Column({ type: 'varchar', length: 20, nullable: true })
  correction_status: string | null;

  @Column({ type: 'enum', enum: AttendanceMode, nullable: true })
  attendance_mode: AttendanceMode | null;

  @Column({
    type: 'enum',
    enum: AttendanceSource,
    default: AttendanceSource.WEB,
  })
  source: AttendanceSource;

  @Column({ type: 'text', nullable: true })
  remote_reason: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'uuid', nullable: true })
  office_id: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  office_name: string | null;

  @Column({ type: 'boolean', default: false })
  is_deleted: boolean;
}
