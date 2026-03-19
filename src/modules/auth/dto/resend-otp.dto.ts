import { IsEmail, IsEnum, IsNotEmpty } from 'class-validator';
import { OtpPurpose } from '../../../common/enums/otp-purpose.enum';

/**
 * DTO for Resend OTP Request
 */
export class ResendOtpDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsEnum(OtpPurpose, {
    message: 'Invalid OTP purpose',
  })
  @IsNotEmpty()
  purpose: OtpPurpose;
}
