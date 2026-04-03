import { Entity, Column, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { SalaryTemplateComponent } from './salary-template-component.entity';

@Entity('salary_templates')
export class SalaryTemplate extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @OneToMany(
    () => SalaryTemplateComponent,
    (salaryTemplateComponent) => salaryTemplateComponent.template,
    {
      cascade: true,
    },
  )
  components: SalaryTemplateComponent[];
}
