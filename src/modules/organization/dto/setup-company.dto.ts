import {
  IsString,
  IsNotEmpty,
  Length,
  IsOptional,
  Matches,
  IsUUID,
} from 'class-validator';

export class SetupCompanyDto {
  @IsString()
  @IsNotEmpty({ message: 'Company name is required' })
  @Length(2, 255, {
    message: 'Company name must be between 2 and 255 characters',
  })
  name: string;

  @IsString()
  @IsOptional()
  @Length(2, 255, {
    message: 'Subdomain must be between 2 and 255 characters',
  })
  @Matches(/^[a-z0-9-]+$/, {
    message:
      'Subdomain can only contain lowercase letters, numbers, and hyphens',
  })
  subdomain: string;

  @IsString()
  @IsNotEmpty({ message: 'Website URL is required' })
  @Length(2, 255, {
    message: 'Website URL must be between 2 and 255 characters',
  })
  website_url: string;

  @IsUUID()
  @IsNotEmpty({ message: 'Business type ID is required' })
  business_type_id: string;

  @IsUUID()
  @IsNotEmpty({ message: 'User ID is required' })
  user_id: string;
}
