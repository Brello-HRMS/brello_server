import {
  IsEnum,
  IsString,
  IsBoolean,
  IsOptional,
  IsObject,
} from 'class-validator';
import { ComponentType, CalculationType } from '../enums/payroll.enum';

export class CreatePayrollComponentDto {
  @IsString()
  name: string;

  @IsEnum(ComponentType)
  type: ComponentType;

  @IsEnum(CalculationType)
  calculation_type: CalculationType;

  @IsOptional()
  @IsObject()
  calculation_value?: Record<string, any>;

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
