import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { LeaveType } from '../../leave-config/entities/leave-type.entity';
import { HalfDaySlot, LeaveRequestStatus } from '../enums';

export interface LeaveRulesSnapshot {
  approval_required: boolean;
  max_per_month: number | null;
  allow_half_day: boolean;
  allow_backdated: boolean;
  max_backdated_days: number | null;
  sandwich_rule: boolean;
}

@Entity('leave_requests')
@Index(['organization_id', 'employee_id', 'request_status'])
@Index(['organization_id', 'request_status', 'from_date'])
@Index(['organization_id', 'employee_id', 'from_date', 'to_date'])
@Index(['leave_type_id'])
export class LeaveRequest extends BaseEntity {
  @Column({ type: 'uuid' })
  employee_id: string;

  @Column({ type: 'uuid' })
  leave_type_id: string;

  @ManyToOne(() => LeaveType, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'leave_type_id' })
  leave_type: LeaveType;

  @Column({ type: 'int' })
  leave_year: number;

  @Column({ type: 'date' })
  from_date: string;

  @Column({ type: 'date' })
  to_date: string;

  @Column({ type: 'boolean', default: false })
  is_half_day: boolean;

  @Column({ type: 'enum', enum: HalfDaySlot, nullable: true })
  half_day_slot: HalfDaySlot | null;

  @Column({ type: 'decimal', precision: 6, scale: 2 })
  total_days: string;

  @Column({ type: 'jsonb', nullable: true })
  computed_days_breakdown: {
    calendar_days: number;
    weekends: number;
    holidays: number;
    sandwich_days_added: number;
    billable_days: number;
  } | null;

  @Column({ type: 'text' })
  reason: string;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  attachment_ids: string[];

  @Column({
    type: 'enum',
    enum: LeaveRequestStatus,
    default: LeaveRequestStatus.DRAFT,
  })
  request_status: LeaveRequestStatus;

  @Column({ type: 'jsonb', nullable: true })
  rules_snapshot: LeaveRulesSnapshot | null;

  @Column({ type: 'timestamp', nullable: true })
  submitted_at: Date | null;

  @Column({ type: 'uuid', nullable: true })
  approved_by: string | null;

  @Column({ type: 'timestamp', nullable: true })
  approved_at: Date | null;

  @Column({ type: 'text', nullable: true })
  approver_comment: string | null;

  @Column({ type: 'uuid', nullable: true })
  rejected_by: string | null;

  @Column({ type: 'timestamp', nullable: true })
  rejected_at: Date | null;

  @Column({ type: 'text', nullable: true })
  rejection_reason: string | null;

  @Column({ type: 'uuid', nullable: true })
  cancelled_by: string | null;

  @Column({ type: 'timestamp', nullable: true })
  cancelled_at: Date | null;

  @Column({ type: 'text', nullable: true })
  cancellation_reason: string | null;

  @Column({ type: 'boolean', default: false })
  cancelled_by_admin: boolean;

  @Column({ type: 'jsonb', nullable: true })
  balance_snapshot_at_approval: {
    leave_type_name: string;
    available_at_approval: number | null;
    consumed_by_this_request: number;
  } | null;
}
