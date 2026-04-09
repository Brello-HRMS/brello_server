import {
  IsInt,
  Min,
  Max,
  IsNumber,
  IsOptional,
} from 'class-validator';

export class CreateLeaveConfigDto {
  @IsInt()
  @Min(1)
  @Max(12)
  leaveYearStartMonth: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  totalLeave?: number;
}
