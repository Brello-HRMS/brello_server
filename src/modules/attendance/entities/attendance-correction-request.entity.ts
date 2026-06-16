import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { AttendanceRecord } from './attendance-record.entity';
import { AttendanceSession } from './attendance-session.entity';
import { CorrectionStatus } from '../enums/correction-status.enum';

/**
 * An employee's dispute of an auto-closed session — they assert the real
 * checkout time. HR approves (recompute with the requested time) or rejects
 * (keep the auto-checkout values). One open request per session.
 */
@Entity('attendance_correction_requests')
@Index(['organization_id', 'approval_status'], { where: '"is_deleted" = false' })
@Index(['attendance_session_id'], {
  unique: true,
  where: '"is_deleted" = false',
})
export class AttendanceCorrectionRequest extends BaseEntity {
  @Column({ type: 'uuid' })
  attendance_record_id: string;

  @ManyToOne(() => AttendanceRecord, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'attendance_record_id' })
  attendance_record: AttendanceRecord;

  @Column({ type: 'uuid' })
  attendance_session_id: string;

  @ManyToOne(() => AttendanceSession, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'attendance_session_id' })
  attendance_session: AttendanceSession;

  @Column({ type: 'uuid' })
  employee_id: string;

  // What the employee claims actually happened.
  @Column({ type: 'timestamptz' })
  requested_check_out_at: Date;

  @Column({ type: 'text' })
  employee_reason: string;

  // Snapshot of what the system auto-closed with, at time of request.
  @Column({ type: 'timestamptz' })
  auto_checkout_at: Date;

  @Column({ type: 'int' })
  auto_worked_minutes: number;

  // Approval workflow.
  @Column({
    type: 'enum',
    enum: CorrectionStatus,
    default: CorrectionStatus.PENDING,
  })
  approval_status: CorrectionStatus;

  @Column({ type: 'uuid', nullable: true })
  reviewed_by: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  reviewed_at: Date | null;

  @Column({ type: 'text', nullable: true })
  reviewer_notes: string | null;

  @Column({ type: 'boolean', default: false })
  is_deleted: boolean;
}
