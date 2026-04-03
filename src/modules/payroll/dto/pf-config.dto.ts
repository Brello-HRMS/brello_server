import { IsNumber, IsBoolean, IsOptional, Min } from 'class-validator';

export class UpsertPfConfigDto {
  @IsNumber()
  @Min(0)
  employee_contribution: number;

  @IsNumber()
  @Min(0)
  employer_contribution: number;

  @IsNumber()
  @Min(0)
  min_salary_threshold: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  wage_ceiling?: number;

  @IsOptional()
  @IsBoolean()
  salary_ceiling_enabled?: boolean;
}
