import { IsEnum, IsNumber, IsString, Length, Min } from 'class-validator';
import { LedgerDirection } from '../enums';

export class AdjustBalanceDto {
  @IsEnum(LedgerDirection)
  direction: LedgerDirection;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  days: number;

  @IsString()
  @Length(5, 500)
  reason: string;
}
