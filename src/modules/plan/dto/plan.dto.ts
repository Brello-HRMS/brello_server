import {
  IsString,
  IsNotEmpty,
  IsNumber,
  Min,
  IsArray,
  IsOptional,
  IsEnum,
  IsUUID,
  Length,
} from 'class-validator';
import { BillingCycle } from '../entities/plan.entity';
import { Status } from '../../../common/enums';

export class CreatePlanDto {
  @IsString()
  @IsNotEmpty()
  @Length(2, 100)
  name: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  price_per_employee_annual?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  annual_discount_percent?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  tier_rank?: number;

  @IsEnum(BillingCycle)
  @IsOptional()
  billing_cycle_default?: BillingCycle;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  discount?: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  feature?: string[];

  @IsUUID()
  @IsOptional()
  enterprise_id?: string;

  @IsEnum(Status)
  @IsOptional()
  status?: Status;
}

export class UpdatePlanDto {
  @IsString()
  @IsOptional()
  @Length(2, 100)
  name?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  price?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  price_per_employee_annual?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  annual_discount_percent?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  tier_rank?: number;

  @IsEnum(BillingCycle)
  @IsOptional()
  billing_cycle_default?: BillingCycle;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  discount?: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  feature?: string[];

  @IsEnum(Status)
  @IsOptional()
  status?: Status;
}
