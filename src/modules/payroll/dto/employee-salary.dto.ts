import {
  IsUUID,
  IsNumber,
  IsDateString,
  IsOptional,
  IsObject,
  IsArray,
  ValidateNested,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

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
  @IsObject()
  overrides?: Record<string, any>;
}

export class ComponentUpdateDto {
  @IsString()
  code: string;

  @IsNumber()
  @Min(0)
  value: number;
}

export class UpdateEmployeeSalaryDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ComponentUpdateDto)
  components: ComponentUpdateDto[];
}
