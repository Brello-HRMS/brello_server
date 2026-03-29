import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsUUID,
} from 'class-validator';

export class CreateHolidayCalendarDto {
  @IsString()
  @IsNotEmpty({ message: 'Calendar name is required' })
  name: string;

  @IsInt()
  @Min(2000)
  @Max(2100)
  @IsNotEmpty({ message: 'Year is required' })
  year: number;

  @IsUUID('4', { message: 'Invalid source calendar ID' })
  @IsOptional()
  clone_from_calendar_id?: string;
}
