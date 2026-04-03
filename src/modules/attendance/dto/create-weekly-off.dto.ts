import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
  IsEnum,
  ArrayUnique,
} from 'class-validator';
import { DayOfWeek } from '../enums/day-of-week.enum';

export class CreateWeeklyOffDto {
  @IsString()
  @IsNotEmpty({ message: 'Weekly off name is required' })
  @MaxLength(100)
  name: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'At least 1 day is required' })
  @ArrayMaxSize(7, { message: 'Maximum 7 days allowed' })
  @ArrayUnique({ message: 'Duplicate days are not allowed' })
  @IsEnum(DayOfWeek, { each: true, message: 'Each day must be a valid day of the week' })
  days: DayOfWeek[];
}
