import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { PayrollFrequency } from '../enums/payroll.enum';

@Entity('payroll_settings')
export class PayrollSetting extends BaseEntity {
  @Column({
    type: 'enum',
    enum: PayrollFrequency,
    default: PayrollFrequency.MONTHLY,
  })
  frequency: PayrollFrequency;

  @Column({ type: 'date' })
  start_date: Date;

  @Column({ type: 'int' })
  cutoff_day: number;

  @Column({ type: 'int' })
  payout_day: number;

  @Column({ type: 'int' })
  payslip_release_day: number;
}
