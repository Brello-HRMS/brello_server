import {
  IsOptional,
  IsString,
  IsUUID,
  IsEnum,
  Matches,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AttendanceMode } from '../enums/attendance-mode.enum';
import { AttendanceStatus } from '../enums/attendance-status.enum';

export class AdminDailyPreviewQueryDto {
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be YYYY-MM-DD' })
  date?: string;

  @IsOptional()
  @IsUUID('4')
  department_id?: string;

  @IsOptional()
  @IsUUID('4')
  shift_id?: string;

  @IsOptional()
  @IsEnum(AttendanceStatus)
  attendance_status?: AttendanceStatus;

  @IsOptional()
  @IsEnum(AttendanceMode)
  attendance_mode?: AttendanceMode;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number = 20;
}
