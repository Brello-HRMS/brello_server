import { IsInt, Min, Max, IsNumber, IsOptional } from 'class-validator';

export class CreateLeaveConfigDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  totalLeave?: number;
}
