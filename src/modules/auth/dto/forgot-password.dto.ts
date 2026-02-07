import { IsEmail, IsNotEmpty, IsString, Length } from 'class-validator';

export class ForgotPasswordRequestDto {
    @IsEmail({}, { message: 'Email must be a valid email address' })
    @IsNotEmpty({ message: 'Email is required' })
    email: string;
}

export class VerifyOtpAndResetPasswordDto {
    @IsEmail({}, { message: 'Email must be a valid email address' })
    @IsNotEmpty({ message: 'Email is required' })
    email: string;

    @IsString()
    @IsNotEmpty({ message: 'OTP is required' })
    @Length(6, 6, { message: 'OTP must be 6 digits' })
    otp: string;

    @IsString()
    @IsNotEmpty({ message: 'New password is required' })
    @Length(8, 100, { message: 'Password must be at least 8 characters long' })
    new_password: string;
}
