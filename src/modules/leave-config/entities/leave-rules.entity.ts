import { Entity, Column, OneToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { LeaveConfig } from './leave-config.entity';

@Entity('leave_rules')
export class LeaveRules extends BaseEntity {
  @Column({ type: 'boolean', default: true })
  approval_required: boolean;

  @Column({ type: 'int', nullable: true })
  max_per_month: number;

  @Column({ type: 'boolean', default: true })
  allow_half_day: boolean;

  @Column({ type: 'boolean', default: false })
  allow_backdated: boolean;

  @Column({ type: 'int', nullable: true })
  max_backdated_days: number;

  @Column({ type: 'boolean', default: false })
  sandwich_rule: boolean;

  @Column({ type: 'uuid' })
  config_id: string;

  @OneToOne(() => LeaveConfig, (config) => config.rules, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'config_id' })
  leave_config: LeaveConfig;
}
