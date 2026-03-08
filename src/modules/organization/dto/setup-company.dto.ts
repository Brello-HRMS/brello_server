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
  @IsNotEmpty({ message: 'Subdomain is required' })
  @Length(2, 255, {
    message: 'Subdomain must be between 2 and 255 characters',
  })
  @Matches(/^[a-z0-9-]+$/, {
    message:
      'Subdomain can only contain lowercase letters, numbers, and hyphens',
  })
  subdomain: string;

  @IsUUID()
  @IsNotEmpty({ message: 'Business type ID is required' })
  business_type_id: string;

  @IsUUID()
  @IsNotEmpty({ message: 'User ID is required' })
  user_id: string;
}
