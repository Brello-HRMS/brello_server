import { IsOptional, IsEnum, IsBoolean, IsDateString, IsInt, Min, IsIn } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ReimbursementStatus } from '../enums/reimbursement.enum';

export class EmployeeReimbursementQueryDto {
  @IsOptional()
  @IsEnum(ReimbursementStatus)
  status?: ReimbursementStatus;

  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  is_paid?: boolean;

  @IsOptional()
  @IsDateString()
  from_date?: string;

  @IsOptional()
  @IsDateString()
  to_date?: string;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sort?: 'asc' | 'desc';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;
}
