import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { ApprovalStatus } from '../enums/approval-status.enum';
import { AttendanceRecord } from './attendance-record.entity';

@Entity('attendance_remote_approvals')
@Index(['organization_id', 'approval_status'])
@Index(['attendance_record_id'], {
  unique: true,
  where: '"is_deleted" = false',
})
export class RemoteApproval extends BaseEntity {
  @Column({ type: 'uuid' })
  attendance_record_id: string;

  @ManyToOne(() => AttendanceRecord, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'attendance_record_id' })
  attendance_record: AttendanceRecord;

  @Column({ type: 'uuid' })
  employee_id: string;

  @Column({ type: 'text' })
  remote_reason: string;

  @Column({ type: 'int', nullable: true })
  distance_from_office_meters: number | null;

  @Column({
    type: 'enum',
    enum: ApprovalStatus,
    default: ApprovalStatus.PENDING,
  })
  approval_status: ApprovalStatus;

  @Column({ type: 'uuid', nullable: true })
  reviewed_by: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  reviewed_at: Date | null;

  @Column({ type: 'text', nullable: true })
  reject_reason: string | null;

  @Column({ type: 'boolean', default: false })
  is_deleted: boolean;
}
