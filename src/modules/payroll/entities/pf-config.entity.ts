import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

@Entity('pf_config')
export class PfConfig extends BaseEntity {
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 12.0 })
  employee_contribution: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 12.0 })
  employer_contribution: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  minimum_salary_threshold: number;

  @Column({ type: 'boolean', default: true })
  is_enabled: boolean;

  @Column({ type: 'date' })
  effective_from: Date;

  @Column({ type: 'date', nullable: true })
  effective_to: Date;
}
