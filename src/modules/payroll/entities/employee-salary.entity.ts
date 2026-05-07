import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { SalaryTemplate } from './salary-template.entity';
import { User } from '../../user/entities/user.entity';

@Entity('employee_salary')
export class EmployeeSalary extends BaseEntity {
  @Column({ type: 'uuid' })
  user_id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'uuid', nullable: true })
  template_id: string | null;

  @ManyToOne(() => SalaryTemplate)
  @JoinColumn({ name: 'template_id' })
  template: SalaryTemplate;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  ctc: number;

  @Column({ type: 'jsonb', nullable: true })
  salary_structure: Record<string, any>;

  @Column({ type: 'date' })
  effective_from: Date;
}
