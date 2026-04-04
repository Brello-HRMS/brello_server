import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsUUID,
  IsNumber,
  Min,
  IsBoolean,
  IsOptional,
  ValidateNested,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';

export class GeoFenceDto {
  @IsString()
  @IsNotEmpty({ message: 'office_name is required for geo-fence' })
  @MaxLength(255)
  office_name: string;

  @IsNumber()
  @Min(-90, { message: 'latitude must be >= -90' })
  latitude: number;

  @IsNumber()
  @Min(-180, { message: 'longitude must be >= -180' })
  longitude: number;

  @IsNumber()
  @Min(1, { message: 'radius_meters must be > 0' })
  radius_meters: number;
}

export class CreateAttendanceRuleDto {
  @IsString()
  @IsNotEmpty({ message: 'Rule name is required' })
  @MaxLength(100)
  name: string;

  @IsUUID('4', { message: 'shift_id must be a valid UUID' })
  @IsNotEmpty({ message: 'shift_id is required' })
  shift_id: string;

  @IsUUID('4', { message: 'weekly_off_id must be a valid UUID' })
  @IsNotEmpty({ message: 'weekly_off_id is required' })
  weekly_off_id: string;

  @IsNumber()
  @Min(0.01, { message: 'full_day_hours must be > 0' })
  full_day_hours: number;

  @IsNumber()
  @Min(0.01, { message: 'half_day_hours must be > 0' })
  half_day_hours: number;

  @IsOptional()
  @IsNumber()
  overtime_after_hours?: number;

  @IsOptional()
  @IsNumber()
  @Min(1, { message: 'overtime_multiplier must be >= 1' })
  overtime_multiplier?: number;

  @IsOptional()
  @IsBoolean()
  allow_multiple_checkins?: boolean;

  @IsOptional()
  @IsBoolean()
  require_geo_fencing?: boolean;

  @IsOptional()
  @ValidateIf((o) => o.require_geo_fencing === true)
  @ValidateNested()
  @Type(() => GeoFenceDto)
  geo_fence?: GeoFenceDto;
}
