import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { SalaryTemplate } from './salary-template.entity';
import { PayrollComponent } from './payroll-component.entity';

@Entity('salary_template_components')
export class SalaryTemplateComponent extends BaseEntity {
  @Column({ type: 'uuid' })
  template_id: string;

  @ManyToOne(() => SalaryTemplate, (t) => t.components)
  @JoinColumn({ name: 'template_id' })
  template: SalaryTemplate;

  @Column({ type: 'uuid' })
  component_id: string;

  @ManyToOne(() => PayrollComponent)
  @JoinColumn({ name: 'component_id' })
  component: PayrollComponent;

  @Column({ type: 'jsonb', nullable: true })
  override_config: Record<string, any>;

  @Column({ type: 'int', default: 0 })
  sort_order: number;
}
