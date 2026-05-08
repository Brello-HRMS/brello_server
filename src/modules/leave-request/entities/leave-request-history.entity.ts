import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { LeaveRequest } from './leave-request.entity';
import { LeaveRequestStatus } from '../enums';

@Entity('leave_request_history')
@Index(['leave_request_id', 'created_at'])
export class LeaveRequestHistory extends BaseEntity {
  @Column({ type: 'uuid' })
  leave_request_id: string;

  @ManyToOne(() => LeaveRequest, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'leave_request_id' })
  leave_request: LeaveRequest;

  @Column({ type: 'enum', enum: LeaveRequestStatus, nullable: true })
  from_status: LeaveRequestStatus | null;

  @Column({ type: 'enum', enum: LeaveRequestStatus })
  to_status: LeaveRequestStatus;

  @Column({ type: 'uuid' })
  actor_id: string;

  @Column({ type: 'text', nullable: true })
  comment: string | null;
}
