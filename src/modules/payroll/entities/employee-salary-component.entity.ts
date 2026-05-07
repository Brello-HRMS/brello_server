import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { ComponentType, CalculationType } from '../enums/payroll.enum';
import { EmployeeSalary } from './employee-salary.entity';

@Entity('employee_salary_components')
export class EmployeeSalaryComponent extends BaseEntity {
  @Column({ type: 'uuid' })
  employee_salary_id: string;

  @ManyToOne(() => EmployeeSalary, (s) => s.components)
  @JoinColumn({ name: 'employee_salary_id' })
  employee_salary: EmployeeSalary;

  @Column({ type: 'varchar', length: 255 })
  component_name: string;

  @Column({ type: 'enum', enum: ComponentType })
  component_type: ComponentType;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  value: number;

  @Column({ type: 'enum', enum: CalculationType })
  calculation_type: CalculationType;

  @Column({ type: 'varchar', length: 255, nullable: true })
  calculate_from: string;

  @Column({ type: 'boolean', default: false })
  is_residual: boolean;

  @Column({ type: 'int', default: 0 })
  calculation_priority: number;
}
