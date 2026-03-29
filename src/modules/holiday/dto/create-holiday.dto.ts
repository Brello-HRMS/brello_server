import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsHexColor,
  IsOptional,
  IsDateString,
} from 'class-validator';
import { HolidayType } from '../enums/holiday-type.enum';

export class CreateHolidayDto {
  @IsString()
  @IsNotEmpty({ message: 'Holiday name is required' })
  name: string;

  @IsDateString({}, { message: 'Invalid date format (ISO 8601 required)' })
  @IsNotEmpty({ message: 'Date is required' })
  date: string;

  @IsEnum(HolidayType)
  @IsNotEmpty({ message: 'Holiday type is required' })
  type: HolidayType;

  @IsHexColor({ message: 'Invalid hex color' })
  @IsOptional()
  color?: string;

  @IsString()
  @IsOptional()
  description?: string;
}
