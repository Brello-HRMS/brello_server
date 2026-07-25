import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  IsEnum,
} from 'class-validator';
import { LoginSource } from '../enums/login-source.enum';

export class LoginPasswordDto {
  @IsEmail({}, { message: 'Email must be a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  password: string;

  @IsString()
  @IsOptional()
  device_fingerprint?: string;
}

export class LoginOtpDto {
  @IsEmail({}, { message: 'Email must be a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @IsEnum(LoginSource)
  @IsOptional()
  login_source?: LoginSource;
}

export class VerifyLoginOtpDto {
  @IsEmail({}, { message: 'Email must be a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'OTP is required' })
  @MinLength(6, { message: 'OTP must be 6 digits' })
  otp: string;

  @IsString()
  @IsOptional()
  device_fingerprint?: string;
}
