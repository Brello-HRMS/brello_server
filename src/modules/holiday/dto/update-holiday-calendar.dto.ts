import { IsString, IsOptional, IsInt, Min, Max } from 'class-validator';

export class UpdateHolidayCalendarDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsInt()
  @Min(2000)
  @Max(2100)
  @IsOptional()
  year?: number;
}
