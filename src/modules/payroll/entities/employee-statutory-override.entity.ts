import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { User } from '../../user/entities/user.entity';

@Entity('employee_statutory_overrides')
export class EmployeeStatutoryOverride extends BaseEntity {
  @Column({ type: 'uuid' })
  employee_id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'employee_id' })
  employee: User;

  @Column({ type: 'boolean', default: true })
  pf_applicable: boolean;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  pf_override_salary: number;

  @Column({ type: 'date' })
  effective_from: Date;
}
