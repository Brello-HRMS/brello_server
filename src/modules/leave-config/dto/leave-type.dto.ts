import {
  IsString,
  IsNotEmpty,
  IsNumber,
  Min,
  IsEnum,
  IsBoolean,
  IsOptional,
} from 'class-validator';

export class LeaveTypeDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  @IsNotEmpty({ message: 'Leave type name is required' })
  name: string;

  @IsNumber()
  @Min(0, { message: 'Days must be at least 0' })
  days: number;

  @IsEnum(['none', 'monthly'], { message: 'Accrual must be either none or monthly' })
  accrual: string;

  @IsBoolean()
  allowHalfDay: boolean;

  @IsOptional()
  @IsBoolean()
  isPaid?: boolean;
}
