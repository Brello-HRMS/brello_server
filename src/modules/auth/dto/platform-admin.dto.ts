import {
  IsString,
  IsNotEmpty,
  IsEmail,
  IsOptional,
  Length,
  Matches,
} from 'class-validator';

export class RegisterPlatformAdminDto {
  @IsString()
  @IsNotEmpty({ message: 'First name is required' })
  @Length(2, 100, {
    message: 'First name must be between 2 and 100 characters',
  })
  first_name: string;

  @IsString()
  @IsOptional()
  @Length(2, 100, {
    message: 'Middle name must be between 2 and 100 characters',
  })
  middle_name?: string;

  @IsString()
  @IsNotEmpty({ message: 'Last name is required' })
  @Length(2, 100, { message: 'Last name must be between 2 and 100 characters' })
  last_name: string;

  @IsEmail({}, { message: 'Email must be a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'Phone number is required' })
  @Matches(/^\+?[1-9]\d{1,14}$/, {
    message: 'Phone must be a valid phone number (E.164 format)',
  })
  phone_number: string;

  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  @Length(8, 100, { message: 'Password must be at least 8 characters long' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
    message:
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
  })
  password: string;
}

export class VerifyRegisterPlatformAdminDto {
  @IsEmail({}, { message: 'Email must be a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'OTP is required' })
  @Length(6, 6, { message: 'OTP must be exactly 6 characters' })
  otp: string;
}

export class LoginPlatformAdminDto {
  @IsEmail({}, { message: 'Email must be a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  password: string;
}

export class VerifyLoginPlatformAdminDto {
  @IsEmail({}, { message: 'Email must be a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'OTP is required' })
  @Length(6, 6, { message: 'OTP must be exactly 6 characters' })
  otp: string;
}
