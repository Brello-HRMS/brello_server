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
  ValidateIf,
} from 'class-validator';
import { HalfDaySlot } from '../enums';

export class CreateLeaveRequestDto {
  @IsUUID()
  leave_type_id: string;

  @IsDateString()
  from_date: string;

  @IsDateString()
  to_date: string;

  @IsOptional()
  @IsBoolean()
  is_half_day?: boolean = false;

  @ValidateIf((o: CreateLeaveRequestDto) => o.is_half_day === true)
  @IsEnum(HalfDaySlot)
  half_day_slot?: HalfDaySlot;

  @IsString()
  @Length(5, 500)
  reason: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsUUID('all', { each: true })
  attachment_ids?: string[];

  @IsOptional()
  @IsBoolean()
  submit?: boolean = true;
}
