import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class RegularizeAttendanceDto {
  @IsString()
  @IsNotEmpty({ message: 'date is required' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'date must be in YYYY-MM-DD format',
  })
  date: string;

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
  @IsString()
  @MaxLength(500)
  reason?: string;
}
