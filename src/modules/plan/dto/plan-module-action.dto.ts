import { IsUUID, IsNotEmpty, IsBoolean, IsOptional } from 'class-validator';

export class CreatePlanModuleActionDto {
  @IsUUID('4')
  @IsNotEmpty()
  plan_id: string;

  @IsUUID('4')
  @IsNotEmpty()
  module_id: string;

  @IsUUID('4')
  @IsNotEmpty()
  action_id: string;

  @IsBoolean()
  @IsOptional()
  enabled?: boolean;
}

export class UpdatePlanModuleActionDto {
  @IsBoolean()
  @IsOptional()
  enabled?: boolean;
}
