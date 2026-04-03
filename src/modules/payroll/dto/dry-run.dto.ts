import { IsUUID, IsNumber, IsOptional, IsObject } from 'class-validator';

export class DryRunDto {
  @IsUUID()
  template_id: string;

  @IsNumber()
  ctc: number;

  @IsOptional()
  @IsObject()
  overrides?: Record<string, any>;

  @IsOptional()
  @IsNumber()
  bonus?: number;

  @IsOptional()
  @IsNumber()
  loan_emi?: number;

  @IsOptional()
  @IsNumber()
  lwp_days?: number;

  @IsOptional()
  @IsNumber()
  other_deductions?: number;
}
