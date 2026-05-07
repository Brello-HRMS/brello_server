import {
  IsEnum,
  IsOptional,
  IsBoolean,
  IsInt,
  Min,
  Max,
  ValidateIf,
} from 'class-validator';
import {
  PayoutType,
  PayoutDayShift,
  AttendanceCutoffType,
  FinancialMonth,
} from '../enums/payroll.enum';

export class CreatePayrollSettingDto {
  @IsEnum(FinancialMonth)
  financial_start_month: FinancialMonth;

  @IsEnum(PayoutType)
  payout_type: PayoutType;

  @ValidateIf((o) => o.payout_type === PayoutType.CUSTOM)
  @IsInt()
  @Min(1)
  @Max(31)
  payout_date?: number;

  @IsOptional()
  @IsEnum(PayoutDayShift)
  payout_day_shift?: PayoutDayShift;

  @IsOptional()
  @IsBoolean()
  consider_holidays?: boolean;

  @IsEnum(AttendanceCutoffType)
  attendance_cutoff_type: AttendanceCutoffType;

  @IsInt()
  @Min(1)
  @Max(31)
  attendance_cutoff_value: number;
}
