import {
  IsString,
  IsNotEmpty,
  Length,
  IsUUID,
  IsOptional,
  IsBoolean,
  IsEnum,
} from 'class-validator';
import { RoleContext } from '../enums/role-context.enum';

export class CreateRoleDto {
  @IsString()
  @IsNotEmpty({ message: 'Role name is required' })
  @Length(2, 100, { message: 'Role name must be between 2 and 100 characters' })
  name: string;

  @IsUUID('4', { message: 'App ID must be a valid UUID' })
  @IsNotEmpty({ message: 'App ID is required' })
  app_id: string;

  @IsUUID('4', { message: 'Enterprise ID must be a valid UUID' })
  @IsNotEmpty({ message: 'Enterprise ID is required' })
  enterprise_id: string;

  @IsUUID('4', { message: 'Organization ID must be a valid UUID' })
  @IsNotEmpty({ message: 'Organization ID is required' })
  organization_id: string;

  @IsBoolean()
  @IsOptional()
  is_system_defined?: boolean;

  @IsEnum(RoleContext, { message: 'Context must be a valid RoleContext value' })
  @IsNotEmpty({ message: 'Role context is required' })
  context: RoleContext;
}
