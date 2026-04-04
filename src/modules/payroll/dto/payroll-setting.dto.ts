import { IsEnum, IsInt, IsDateString, Min, Max } from 'class-validator';
import { PayrollFrequency } from '../enums/payroll.enum';

export class CreatePayrollSettingDto {
  @IsEnum(PayrollFrequency)
  frequency: PayrollFrequency;

  @IsDateString()
  start_date: string;

  @IsInt()
  @Min(1)
  @Max(31)
  cutoff_day: number;

  @IsInt()
  @Min(1)
  @Max(31)
  payout_day: number;

  @IsInt()
  @Min(1)
  @Max(31)
  payslip_release_day: number;
}
