import { IsNumber, IsBoolean, IsOptional, Min, IsDateString } from 'class-validator';

export class UpsertPfConfigDto {
  @IsNumber()
  @Min(0)
  employee_contribution: number;

  @IsNumber()
  @Min(0)
  employer_contribution: number;

  @IsNumber()
  @Min(0)
  minimum_salary_threshold: number;

  /**
   * Cap PF base at the wage ceiling (true, statutory default) or contribute on
   * the full basic (false). Defaults to true when omitted.
   */
  @IsOptional()
  @IsBoolean()
  restrict_to_ceiling?: boolean;

  @IsOptional()
  @IsBoolean()
  is_enabled?: boolean;

  @IsDateString()
  effective_from: string;
}
