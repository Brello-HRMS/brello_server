import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import {
  ComponentType,
  ComponentCategory,
  CalculationType,
} from '../enums/payroll.enum';

@Entity('payroll_components')
export class PayrollComponent extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'enum', enum: ComponentType })
  component_type: ComponentType;

  @Column({ type: 'enum', enum: ComponentCategory })
  category: ComponentCategory;

  @Column({ type: 'enum', enum: CalculationType })
  calculation_type: CalculationType;

  @Column({ type: 'uuid', nullable: true })
  calculate_from: string;

  @ManyToOne(() => PayrollComponent, { nullable: true, eager: false })
  @JoinColumn({ name: 'calculate_from' })
  base_component: PayrollComponent;

  @Column({ type: 'decimal', precision: 12, scale: 4, nullable: true })
  value: number;

  @Column({ type: 'boolean', default: false })
  is_taxable: boolean;

  @Column({ type: 'boolean', default: false })
  is_residual: boolean;

  @Column({ type: 'boolean', default: false })
  is_default: boolean;

  @Column({ type: 'boolean', default: true })
  is_editable: boolean;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @Column({ type: 'int', default: 0 })
  calculation_priority: number;
}
