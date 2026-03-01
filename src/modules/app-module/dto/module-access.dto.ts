import { IsBoolean, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

export class CreateModuleAccessDto {
  @IsUUID('4')
  @IsNotEmpty()
  role_id: string;

  @IsUUID('4')
  @IsNotEmpty()
  module_id: string;

  @IsUUID('4')
  @IsNotEmpty()
  action_id: string;

  @IsBoolean()
  @IsOptional()
  access_flag?: boolean;
}

export class UpdateModuleAccessDto {
  @IsBoolean()
  @IsNotEmpty()
  access_flag: boolean;
}
