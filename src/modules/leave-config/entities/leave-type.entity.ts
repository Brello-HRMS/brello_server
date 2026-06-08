import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { LeaveConfig } from './leave-config.entity';

@Entity('leave_types')
export class LeaveType extends BaseEntity {
  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'int' })
  days: number;

  @Column({
    type: 'enum',
    enum: ['none', 'monthly'],
    default: 'none',
  })
  accrual: string;

  @Column({ type: 'boolean', default: true })
  allow_half_day: boolean;

  @Column({ type: 'boolean', default: true })
  is_paid: boolean;

  @Column({ type: 'uuid' })
  config_id: string;

  @ManyToOne(() => LeaveConfig, (config) => config.leave_types, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'config_id' })
  leave_config: LeaveConfig;
}
