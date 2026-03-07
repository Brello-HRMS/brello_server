import {
  IsString,
  IsNotEmpty,
  IsOptional,
  MaxLength,
  Length,
  IsUUID,
  IsBoolean,
} from 'class-validator';

export class CreateRoleDto {
  @IsString()
  @IsNotEmpty({ message: 'Role name is required' })
  @Length(2, 100, { message: 'Role name must be between 2 and 100 characters' })
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  code?: string;

  @IsUUID('4', { message: 'App ID must be a valid UUID' })
  @IsNotEmpty({ message: 'App ID is required' })
  app_id: string;

  @IsUUID('4', { message: 'Enterprise ID must be a valid UUID' })
  @IsOptional()
  enterprise_id?: string;

  @IsUUID('4', { message: 'Organization ID must be a valid UUID' })
  @IsOptional()
  organization_id?: string;

  @IsBoolean()
  @IsOptional()
  is_system_defined?: boolean;
}
