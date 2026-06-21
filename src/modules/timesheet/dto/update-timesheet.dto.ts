import {
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';

const TIME_PATTERN = /^\d{2}:\d{2}$/;
const TIME_PATTERN_MESSAGE = 'must be in HH:MM format (e.g. "09:00")';

export class UpdateTimesheetDto {
  @IsOptional()
  @IsUUID()
  project_id?: string;

  @IsOptional()
  @IsDateString()
  entry_date?: string;

  @IsOptional()
  @IsString()
  @Matches(TIME_PATTERN, { message: `start_time ${TIME_PATTERN_MESSAGE}` })
  start_time?: string;

  @IsOptional()
  @IsString()
  @Matches(TIME_PATTERN, { message: `end_time ${TIME_PATTERN_MESSAGE}` })
  end_time?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  task_description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
