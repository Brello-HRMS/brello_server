import {
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CarryForwardItemDto {
  @IsUUID()
  leave_type_id: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  days: number;
}

export class InitializeBalanceDto {
  @IsUUID()
  employee_id: string;

  @IsInt()
  @Min(2000)
  leave_year: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CarryForwardItemDto)
  carry_forward?: CarryForwardItemDto[];
}
