import {
  IsUUID,
  IsNumber,
  IsDateString,
  IsOptional,
  IsArray,
  ValidateNested,
  IsString,
  IsEnum,
  Min,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PropagationScope } from '../enums/payroll.enum';

export class AssignEmployeeSalaryDto {
  @IsUUID()
  user_id: string;

  @IsUUID()
  template_id: string;

  @IsNumber()
  ctc: number;

  @IsDateString()
  effective_from: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  component_ids?: string[];

  @IsOptional()
  @IsObject()
  overrides?: Record<string, number>;
}

export class BulkAssignEmployeeSalaryDto {
  @IsArray()
  @IsUUID('4', { each: true })
  user_ids: string[];

  @IsUUID()
  template_id: string;

  @IsNumber()
  ctc: number;

  @IsDateString()
  effective_from: string;
}

export class ComponentUpdateDto {
  @IsString()
  component_name: string;

  @IsNumber()
  @Min(0)
  value: number;
}

export class UpdateEmployeeSalaryDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ComponentUpdateDto)
  components: ComponentUpdateDto[];

  @IsDateString()
  effective_from: string;
}

export class PropagationPreviewDto {
  @IsUUID()
  component_id: string;
}

export class PropagationApplyDto {
  @IsUUID()
  component_id: string;

  @IsEnum(PropagationScope)
  scope: PropagationScope;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  employee_ids?: string[];

  @IsDateString()
  effective_from: string;
}

export class EmployeeStatutoryOverrideDto {
  @IsOptional()
  pf_applicable?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  pf_override_salary?: number;

  @IsDateString()
  effective_from: string;
}
