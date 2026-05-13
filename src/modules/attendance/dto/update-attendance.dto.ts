import {
  IsOptional,
  IsString,
  IsEnum,
  Matches,
  MaxLength,
} from 'class-validator';
import { AttendanceMode } from '../enums/attendance-mode.enum';
import { AttendanceStatus } from '../enums/attendance-status.enum';

export class UpdateAttendanceDto {
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'check_in must be HH:mm (24-hour)',
  })
  check_in?: string;

  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'check_out must be HH:mm (24-hour)',
  })
  check_out?: string;

  @IsOptional()
  @IsEnum(AttendanceMode)
  attendance_mode?: AttendanceMode;

  @IsOptional()
  @IsEnum(AttendanceStatus)
  attendance_status_override?: AttendanceStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  remote_reason?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
