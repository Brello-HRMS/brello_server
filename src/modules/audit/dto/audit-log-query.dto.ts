import {
  IsOptional,
  IsDateString,
  IsEnum,
  IsUUID,
  IsString,
  IsInt,
  IsIn,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AuditLogModule } from '../enums/audit-log-module.enum';
import { AuditAction } from '../enums/audit-action.enum';

export class AuditLogQueryDto {
  @IsOptional()
  @IsDateString()
  date_from?: string;

  @IsOptional()
  @IsDateString()
  date_to?: string;

  @IsOptional()
  @IsEnum(AuditLogModule)
  module?: AuditLogModule;

  @IsOptional()
  @IsEnum(AuditAction)
  action?: AuditAction;

  @IsOptional()
  @IsUUID('4')
  actor_id?: string;

  @IsOptional()
  @IsString()
  entity_type?: string;

  @IsOptional()
  @IsUUID('4')
  entity_id?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  changed_field?: string;

  @IsOptional()
  @IsIn(['created_at', 'actor_name', 'module'])
  sort_by?: 'created_at' | 'actor_name' | 'module' = 'created_at';

  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  sort_order?: 'ASC' | 'DESC' = 'DESC';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export class PlatformAuditLogQueryDto extends AuditLogQueryDto {
  @IsOptional()
  @IsUUID('4')
  organization_id?: string;

  @IsOptional()
  @IsUUID('4')
  enterprise_id_filter?: string;
}
