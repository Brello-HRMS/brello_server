import { IsBoolean, IsNotEmpty, IsOptional, IsString, IsUUID, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class AssignModuleAccessByCodeDto {
  @IsString()
  @IsNotEmpty()
  module_code: string;

  @IsString()
  @IsNotEmpty()
  action_code: string;

  @IsBoolean()
  @IsOptional()
  access_flag?: boolean;
}

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

export class UpdateRolePermissionItemDto {
  @IsUUID('4')
  @IsNotEmpty()
  module_id: string;

  @IsUUID('4')
  @IsNotEmpty()
  action_id: string;

  @IsBoolean()
  @IsNotEmpty()
  checked: boolean;
}

export class UpdateRolePermissionsListDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateRolePermissionItemDto)
  permissions: UpdateRolePermissionItemDto[];
}
