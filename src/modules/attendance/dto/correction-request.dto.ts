import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CorrectionStatus } from '../enums/correction-status.enum';

export class SubmitCorrectionDto {
  @IsUUID()
  attendance_session_id: string;

  /** The checkout time the employee asserts actually happened (ISO 8601). */
  @IsDateString()
  requested_check_out_at: string;

  @IsString()
  @MinLength(10, { message: 'Please provide a reason of at least 10 characters.' })
  employee_reason: string;
}

export class RejectCorrectionDto {
  @IsOptional()
  @IsString()
  reviewer_notes?: string;
}

export class CorrectionListQueryDto {
  @IsOptional()
  @IsEnum(CorrectionStatus)
  approval_status?: CorrectionStatus;

  @IsOptional()
  @IsUUID()
  employee_id?: string;

  @IsOptional()
  @IsDateString()
  from_date?: string;

  @IsOptional()
  @IsDateString()
  to_date?: string;

  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  limit?: number = 20;
}
