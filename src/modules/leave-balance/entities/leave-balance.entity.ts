import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { LeaveType } from '../../leave-config/entities/leave-type.entity';

@Entity('leave_balances')
@Index(['organization_id', 'employee_id', 'leave_type_id', 'leave_year'], {
  unique: true,
})
@Index(['organization_id', 'employee_id', 'leave_year'])
@Index(['organization_id', 'leave_year', 'status'])
export class LeaveBalance extends BaseEntity {
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
  cycle_start: string;

  @Column({ type: 'date' })
  cycle_end: string;

  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true })
  allocated_days: string | null;

  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true })
  accrued_days: string | null;

  @Column({
    type: 'decimal',
    precision: 6,
    scale: 2,
    nullable: true,
    default: 0,
  })
  carry_forward: string | null;

  @Column({ type: 'decimal', precision: 6, scale: 2, default: 0 })
  adjustment: string;

  @Column({ type: 'decimal', precision: 6, scale: 2, default: 0 })
  used_days: string;

  @Column({ type: 'decimal', precision: 6, scale: 2, default: 0 })
  pending_days: string;

  @Column({ type: 'boolean', default: false })
  is_unlimited: boolean;
}
