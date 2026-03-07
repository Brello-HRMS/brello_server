import {
  IsString,
  IsNotEmpty,
  IsEmail,
  IsOptional,
  Length,
  Matches,
  IsIn,
} from 'class-validator';

export class CreateLeadDto {
  @IsEmail({}, { message: 'Email must be a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'First name is required' })
  @Length(2, 100, {
    message: 'First name must be between 2 and 100 characters',
  })
  first_name: string;

  @IsString()
  @IsNotEmpty({ message: 'Last name is required' })
  @Length(2, 100, {
    message: 'Last name must be between 2 and 100 characters',
  })
  last_name: string;

  @IsString()
  @IsNotEmpty({ message: 'Phone number is required' })
  @Matches(/^\+?[1-9]\d{1,14}$/, {
    message: 'Phone must be a valid phone number (E.164 format)',
  })
  phone: string;

  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  @Length(8, 100, { message: 'Password must be at least 8 characters long' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
    message:
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
  })
  password: string;

  @IsString()
  @IsNotEmpty({ message: 'Source is required' })
  @IsIn(['website'], { message: 'Source must be website' })
  source: string;

  @IsString()
  @IsOptional()
  location?: string;

  @IsString()
  @IsOptional()
  device?: string;

  @IsString()
  @IsNotEmpty({ message: 'Plan ID is required' })
  plan_id: string;
}
