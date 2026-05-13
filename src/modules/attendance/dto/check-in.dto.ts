import {
  IsOptional,
  IsNumber,
  IsString,
  Min,
  Max,
  MaxLength,
  IsIn,
} from 'class-validator';
import { AttendanceSource } from '../enums/attendance-source.enum';

export class CheckInDto {
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @IsOptional()
  @IsIn([AttendanceSource.WEB, AttendanceSource.MOBILE])
  device?: AttendanceSource.WEB | AttendanceSource.MOBILE;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  remote_reason?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
