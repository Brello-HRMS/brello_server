import {
  IsString,
  IsEnum,
  IsHexColor,
  IsOptional,
  IsDateString,
} from 'class-validator';
import { HolidayType } from '../enums/holiday-type.enum';

export class UpdateHolidayDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsDateString()
  @IsOptional()
  date?: string;

  @IsEnum(HolidayType)
  @IsOptional()
  type?: HolidayType;

  @IsHexColor()
  @IsOptional()
  color?: string;

  @IsString()
  @IsOptional()
  description?: string;
}
