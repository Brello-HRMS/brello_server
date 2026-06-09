import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsArray,
  IsUUID,
  MaxLength,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  FinancialMonth,
  PayrollItemStatus,
  PayrollRunStatus,
} from '../enums/payroll.enum';

export class CreatePayrollRunDto {
  @IsEnum(FinancialMonth, { message: 'month must be a valid financial month' })
  month: FinancialMonth;

  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year: number;
}

export class PayrollRunQueryDto {
  @IsOptional()
  @IsEnum(PayrollRunStatus)
  status?: PayrollRunStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;
}

export class RunItemsQueryDto {
  @IsOptional()
  @IsEnum(PayrollItemStatus)
  status?: PayrollItemStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number = 50;
}

export class DisburseRunDto {
  /** Optional payout reference (NEFT/UTR batch, bank file id, etc.). */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reference?: string;

  /** Optional subset of item ids to mark paid; omitted = all processed items. */
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  item_ids?: string[];
}
