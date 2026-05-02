import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import {
  PayrollFrequency,
  PayoutType,
  PayoutDayShift,
  AttendanceCutoffType,
  FinancialMonth,
} from '../enums/payroll.enum';

@Entity('payroll_settings')
export class PayrollSetting extends BaseEntity {
  @Column({
    type: 'enum',
    enum: PayrollFrequency,
    default: PayrollFrequency.MONTHLY,
  })
  frequency: PayrollFrequency;

  @Column({ type: 'enum', enum: FinancialMonth })
  financial_start_month: FinancialMonth;

  @Column({ type: 'enum', enum: FinancialMonth })
  financial_end_month: FinancialMonth;

  @Column({ type: 'varchar', length: 10 })
  financial_year_label: string;

  @Column({ type: 'enum', enum: PayoutType })
  payout_type: PayoutType;

  @Column({ type: 'int', nullable: true })
  payout_date: number;

  @Column({ type: 'enum', enum: PayoutDayShift, nullable: true })
  payout_day_shift: PayoutDayShift;

  @Column({ type: 'boolean', default: true })
  consider_holidays: boolean;

  @Column({ type: 'enum', enum: AttendanceCutoffType })
  attendance_cutoff_type: AttendanceCutoffType;

  @Column({ type: 'int' })
  attendance_cutoff_value: number;
}
