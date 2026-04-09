import { Entity, Column, OneToMany, OneToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { LeaveType } from './leave-type.entity';
import { LeaveRules } from './leave-rules.entity';

@Entity('leave_configs')
export class LeaveConfig extends BaseEntity {
  @Column({ type: 'int', default: 1 })
  leave_year_start_month: number;

  @Column({ type: 'int', nullable: true })
  total_leave: number;

  @OneToMany(() => LeaveType, (leaveType) => leaveType.leave_config, {
    cascade: true,
  })
  leave_types: LeaveType[];

  @OneToOne(() => LeaveRules, (leaveRules) => leaveRules.leave_config, {
    cascade: true,
  })
  rules: LeaveRules;
}
