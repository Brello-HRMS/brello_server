import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsPhoneNumber,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateOrganizationProfileDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @IsEmail()
  @IsNotEmpty()
  @MaxLength(255)
  email: string;

  @IsPhoneNumber('IN') // Default to India but adaptable
  @IsNotEmpty()
  @MaxLength(50)
  phone: string;

  @IsUUID()
  @IsOptional()
  logo_id?: string;

  @IsUUID()
  @IsOptional()
  industry_type_id?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  domain?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  registration_no: string;

  @IsUUID()
  @IsNotEmpty()
  organization_id: string;

  @IsUUID()
  @IsNotEmpty()
  enterprise_id: string;

  @IsUUID()
  @IsOptional()
  parent_id?: string;
}
