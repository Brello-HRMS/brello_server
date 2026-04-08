import {
  IsEnum,
  IsString,
  IsBoolean,
  IsOptional,
  IsObject,
  ValidateNested,
  IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ComponentType, CalculationType } from '../enums/payroll.enum';

export class CalculationValueDto {
  @IsOptional()
  @IsNumber()
  value?: number;

  @IsOptional()
  @IsString()
  base?: string;
}

export class CreatePayrollComponentDto {
  @IsString()
  name: string;

  @IsEnum(ComponentType)
  type: ComponentType;

  @IsEnum(CalculationType)
  calculation_type: CalculationType;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => CalculationValueDto)
  calculation_value?: CalculationValueDto;

  @IsOptional()
  @IsBoolean()
  is_taxable?: boolean;

  @IsOptional()
  @IsBoolean()
  is_system_defined?: boolean;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
