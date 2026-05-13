import {
  IsString,
  IsNotEmpty,
  MaxLength,
  Matches,
  IsOptional,
  IsInt,
  Min,
  IsBoolean,
  IsNumber,
} from 'class-validator';

export class CreateShiftDto {
  @IsString()
  @IsNotEmpty({ message: 'Shift name is required' })
  @MaxLength(100)
  name: string;

  @IsString()
  @IsNotEmpty({ message: 'Start time is required' })
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'start_time must be in HH:mm (24-hour) format',
  })
  start_time: string;

  @IsString()
  @IsNotEmpty({ message: 'End time is required' })
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'end_time must be in HH:mm (24-hour) format',
  })
  end_time: string;

  @IsOptional()
  @IsInt()
  @Min(0, { message: 'late_grace_minutes must be >= 0' })
  late_grace_minutes?: number;

  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'auto_checkout_time must be in HH:mm (24-hour) format',
  })
  auto_checkout_time?: string;

  @IsOptional()
  @IsBoolean()
  is_night_shift?: boolean;

  @IsOptional()
  @IsBoolean()
  allow_multiple_checkins?: boolean;

  @IsOptional()
  @IsNumber({}, { message: 'full_day_hours must be a number' })
  @Min(0.01, { message: 'full_day_hours must be > 0' })
  full_day_hours?: number;

  @IsOptional()
  @IsNumber({}, { message: 'half_day_hours must be a number' })
  @Min(0.01, { message: 'half_day_hours must be > 0' })
  half_day_hours?: number;
}
