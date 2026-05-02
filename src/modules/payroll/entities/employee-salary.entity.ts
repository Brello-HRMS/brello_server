import { Entity, Column, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { User } from '../../user/entities/user.entity';
import { EmployeeSalaryComponent } from './employee-salary-component.entity';

@Entity('employee_salary')
export class EmployeeSalary extends BaseEntity {
  @Column({ type: 'uuid' })
  user_id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'int', default: 1 })
  version_number: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  ctc: number;

  @Column({ type: 'date' })
  effective_from: Date;

  @Column({ type: 'date', nullable: true })
  effective_to: Date;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @OneToMany(() => EmployeeSalaryComponent, (c: EmployeeSalaryComponent) => c.employee_salary, {
    cascade: true,
    eager: false,
  })
  components: EmployeeSalaryComponent[];
}
