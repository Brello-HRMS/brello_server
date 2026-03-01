import { IsUUID, IsNotEmpty, IsBoolean, IsOptional } from 'class-validator';

export class CreatePlanModuleDto {
  @IsUUID('4')
  @IsNotEmpty()
  plan_id: string;

  @IsUUID('4')
  @IsNotEmpty()
  module_id: string;

  @IsBoolean()
  @IsOptional()
  enabled?: boolean;
}

export class UpdatePlanModuleDto {
  @IsBoolean()
  @IsOptional()
  enabled?: boolean;
}
