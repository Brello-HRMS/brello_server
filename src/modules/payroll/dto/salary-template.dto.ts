import {
  IsString,
  IsOptional,
  IsBoolean,
  IsArray,
  ValidateNested,
  IsUUID,
  IsInt,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SalaryTemplateComponentDto {
  @IsUUID()
  component_id: string;

  @IsOptional()
  @IsObject()
  override_config?: Record<string, any>;

  @IsInt()
  sort_order: number;
}

export class CreateSalaryTemplateDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SalaryTemplateComponentDto)
  components: SalaryTemplateComponentDto[];
}
