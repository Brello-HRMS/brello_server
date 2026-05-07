import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { ComponentType, CalculationType } from '../enums/payroll.enum';

@Entity('payroll_components')
export class PayrollComponent extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'boolean', default: true })
  is_editable: boolean;

  @Column({
    type: 'enum',
    enum: ComponentType,
    nullable: true,
  })
  type: ComponentType;

  @Column({
    type: 'enum',
    enum: CalculationType,
  })
  calculation_type: CalculationType;

  @Column({ type: 'jsonb', nullable: true })
  calculation_value: Record<string, any>;

  @Column({ type: 'boolean', default: false })
  is_taxable: boolean;

  @Column({ type: 'boolean', default: false })
  is_system_defined: boolean;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;
}
