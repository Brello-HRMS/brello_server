import {
  IsBoolean,
  IsOptional,
  IsNumber,
  Min,
} from 'class-validator';

export class LeaveRulesDto {
  @IsBoolean()
  approvalRequired: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxPerMonth?: number;

  @IsBoolean()
  allowHalfDay: boolean;

  @IsBoolean()
  allowBackdated: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxBackdatedDays?: number;

  @IsBoolean()
  sandwichRule: boolean;
}
