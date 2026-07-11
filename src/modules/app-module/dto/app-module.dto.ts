import {
  IsString,
  IsNotEmpty,
  IsUUID,
  IsEnum,
  IsOptional,
  IsArray,
  ArrayMinSize,
  ValidateNested,
  Length,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ModuleType } from '../entities/app-module.entity';

export class CreateAppModuleDto {
  @IsString()
  @IsNotEmpty()
  @Length(2, 150)
  name: string;

  @IsString()
  @IsNotEmpty()
  @Length(2, 100)
  code: string;

  @IsUUID('4')
  @IsNotEmpty()
  app_id: string;

  @IsString()
  @IsNotEmpty()
  @Length(1, 50)
  wbs_code: string;

  @IsUUID('4')
  @IsOptional()
  parent_id?: string;

  @IsEnum(ModuleType)
  @IsOptional()
  type?: ModuleType;

  @IsString()
  @IsOptional()
  @Length(1, 50)
  icon?: string;

  @IsString()
  @IsOptional()
  @Length(1, 150)
  path?: string;
}

export class UpdateAppModuleDto {
  @IsString()
  @IsOptional()
  @Length(2, 150)
  name?: string;

  @IsString()
  @IsOptional()
  @Length(2, 100)
  code?: string;

  @IsString()
  @IsOptional()
  @Length(1, 50)
  wbs_code?: string;

  /** Pass a UUID to reparent, or `null` to promote this module to top-level. */
  @IsUUID('4')
  @IsOptional()
  parent_id?: string | null;

  @IsEnum(ModuleType)
  @IsOptional()
  type?: ModuleType;

  @IsString()
  @IsOptional()
  @Length(1, 50)
  icon?: string;

  @IsString()
  @IsOptional()
  @Length(1, 150)
  path?: string;
}

export class ReorderModuleItemDto {
  @IsUUID('4')
  @IsNotEmpty()
  id: string;

  /** `null` = top-level module; a UUID = child of that module. */
  @IsUUID('4')
  @IsOptional()
  parent_id?: string | null;

  @IsString()
  @IsNotEmpty()
  @Length(1, 50)
  wbs_code: string;

  @IsEnum(ModuleType)
  @IsNotEmpty()
  type: ModuleType;
}

export class ReorderAppModulesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReorderModuleItemDto)
  updates: ReorderModuleItemDto[];
}
