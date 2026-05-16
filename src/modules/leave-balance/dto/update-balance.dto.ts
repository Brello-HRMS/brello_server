import { IsNumber, IsString, Length, Min } from 'class-validator';

export class UpdateBalanceDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  allocated_days: number;

  @IsString()
  @Length(5, 500)
  reason: string;
}
