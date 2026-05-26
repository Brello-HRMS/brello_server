import { Entity, Column, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { User } from './user.entity';
import { ExitType } from '../enums/user.enum';

@Entity('employee_offboarding')
export class EmployeeOffboarding extends BaseEntity {
  @Column({ type: 'uuid' })
  @Index()
  user_id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'enum', enum: ExitType })
  exit_type: ExitType;

  @Column({ type: 'text', nullable: true })
  reason: string;

  @Column({ type: 'date' })
  last_working_day: Date;

  @Column({ type: 'int', default: 30 })
  notice_period: number;

  @Column({ type: 'uuid', nullable: true })
  handover_to_user_id: string | null;

  @Column({ type: 'jsonb', nullable: true })
  assets_to_recover: string[] | null;

  @Column({ type: 'boolean', default: false })
  schedule_exit_interview: boolean;

  @Column({ type: 'boolean', default: false })
  is_cancelled: boolean;
}
