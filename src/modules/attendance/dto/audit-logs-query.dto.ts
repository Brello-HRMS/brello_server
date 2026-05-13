import {
  IsOptional,
  IsUUID,
  IsString,
  IsEnum,
  Matches,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AuditEventType } from '../enums/audit-event-type.enum';

export class AuditLogsQueryDto {
  @IsOptional()
  @IsUUID('4')
  employee_id?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be YYYY-MM-DD' })
  date?: string;

  @IsOptional()
  @IsEnum(AuditEventType)
  event_type?: AuditEventType;

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
