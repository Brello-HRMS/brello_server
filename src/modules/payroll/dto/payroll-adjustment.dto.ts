import {
  IsEnum,
  IsNumber,
  IsPositive,
  IsOptional,
  IsString,
  MaxLength,
  Max,
} from 'class-validator';
import { AdjustmentType } from '../enums/payroll.enum';

export class CreateAdjustmentDto {
  @IsEnum(AdjustmentType, {
    message: 'type must be either bonus or deduction',
  })
  adjustment_type: AdjustmentType;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive({ message: 'amount must be greater than zero' })
  @Max(99999999)
  amount: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
