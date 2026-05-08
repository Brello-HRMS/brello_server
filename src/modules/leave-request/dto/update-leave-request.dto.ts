import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Length,
} from 'class-validator';
import { HalfDaySlot } from '../enums';

export class UpdateLeaveRequestDto {
  @IsOptional()
  @IsUUID()
  leave_type_id?: string;

  @IsOptional()
  @IsDateString()
  from_date?: string;

  @IsOptional()
  @IsDateString()
  to_date?: string;

  @IsOptional()
  @IsBoolean()
  is_half_day?: boolean;

  @IsOptional()
  @IsEnum(HalfDaySlot)
  half_day_slot?: HalfDaySlot;

  @IsOptional()
  @IsString()
  @Length(5, 500)
  reason?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsUUID('all', { each: true })
  attachment_ids?: string[];
}
