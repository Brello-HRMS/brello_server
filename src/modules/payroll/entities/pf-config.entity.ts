import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

@Entity('pf_config')
export class PfConfig extends BaseEntity {
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 12.0 })
  employee_contribution: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 12.0 })
  employer_contribution: number;

  /**
   * EPF wage *ceiling* (statutory default ₹15,000/month) — despite the legacy
   * name, this is an upper cap, not a floor. PF base is capped at this value when
   * `restrict_to_ceiling` is true. (Rename to `pf_wage_ceiling` is a recommended
   * follow-up.)
   */
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  minimum_salary_threshold: number;

  /**
   * When true (default, statutory), PF is computed on min(basic, ceiling).
   * When false, PF is computed on the full basic ("PF on actual basic") —
   * matching the capping toggle in Zoho Payroll / greytHR / Keka.
   */
  @Column({ type: 'boolean', default: true })
  restrict_to_ceiling: boolean;

  @Column({ type: 'boolean', default: true })
  is_enabled: boolean;

  @Column({ type: 'date' })
  effective_from: Date;

  @Column({ type: 'date', nullable: true })
  effective_to: Date;
}
