import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';

const TIME_PATTERN = /^\d{2}:\d{2}$/;
const TIME_PATTERN_MESSAGE = 'must be in HH:MM format (e.g. "09:00")';

export class CreateTimesheetDto {
  @IsUUID()
  @IsNotEmpty()
  project_id: string;

  /** ISO 8601 date string: YYYY-MM-DD */
  @IsDateString()
  @IsNotEmpty()
  entry_date: string;

  /** 24-hour time string: HH:MM */
  @IsString()
  @Matches(TIME_PATTERN, { message: `start_time ${TIME_PATTERN_MESSAGE}` })
  start_time: string;

  /** 24-hour time string: HH:MM — must be greater than start_time */
  @IsString()
  @Matches(TIME_PATTERN, { message: `end_time ${TIME_PATTERN_MESSAGE}` })
  end_time: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  task_description: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
