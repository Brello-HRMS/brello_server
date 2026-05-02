import {
  IsEnum,
  IsString,
  IsBoolean,
  IsOptional,
  IsNumber,
  IsUUID,
  IsInt,
  Min,
} from 'class-validator';
import {
  ComponentType,
  ComponentCategory,
  CalculationType,
} from '../enums/payroll.enum';

export class CreatePayrollComponentDto {
  @IsString()
  name: string;

  @IsEnum(ComponentType)
  component_type: ComponentType;

  @IsEnum(ComponentCategory)
  category: ComponentCategory;

  @IsEnum(CalculationType)
  calculation_type: CalculationType;

  @IsOptional()
  @IsUUID()
  calculate_from?: string;

  @IsOptional()
  @IsNumber()
  value?: number;

  @IsOptional()
  @IsBoolean()
  is_taxable?: boolean;

  @IsOptional()
  @IsBoolean()
  is_residual?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  calculation_priority?: number;
}

export class UpdatePayrollComponentDto {
  @IsOptional()
  @IsNumber()
  value?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  calculation_priority?: number;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsBoolean()
  is_taxable?: boolean;
}
