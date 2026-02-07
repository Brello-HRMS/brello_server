import {
    Controller,
    Post,
    Body,
    HttpCode,
    HttpStatus,
    UseGuards,
} from '@nestjs/common';
import { AuthService } from '../services/auth.service';
import { LoginDto } from '../dto/login.dto';
import { UpdatePasswordDto } from '../dto/update-password.dto';
import { ForgotPasswordRequestDto, VerifyOtpAndResetPasswordDto } from '../dto/forgot-password.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { JwtRefreshAuthGuard } from '../guards/jwt-refresh-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../interfaces/jwt-payload.interface';

// Auth Controller - Handles HTTP requests for authentication and authorization
@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) { }

    // User login
    @Post('login')
    @HttpCode(HttpStatus.OK)
    login(@Body() loginDto: LoginDto) {
        return this.authService.login(loginDto);
    }

    // User logout (requires authentication)
    @Post('logout')
    @UseGuards(JwtAuthGuard)
    @HttpCode(HttpStatus.NO_CONTENT)
    logout(@CurrentUser() user: JwtPayload) {
        return this.authService.logout(user.sessionId);
    }

    // Refresh access token (requires refresh token)
    @Post('refresh')
    @UseGuards(JwtRefreshAuthGuard)
    @HttpCode(HttpStatus.OK)
    refresh(@CurrentUser() user: JwtPayload) {
        return this.authService.refreshToken(user);
    }

    // Update password (requires authentication)
    @Post('update-password')
    @UseGuards(JwtAuthGuard)
    @HttpCode(HttpStatus.NO_CONTENT)
    updatePassword(
        @CurrentUser() user: JwtPayload,
        @Body() updatePasswordDto: UpdatePasswordDto,
    ) {
        return this.authService.updatePassword(user.userId, updatePasswordDto);
    }

    // Initiate password reset flow by sending OTP
    @Post('forgot-password')
    @HttpCode(HttpStatus.NO_CONTENT)
    forgotPassword(@Body() forgotPasswordDto: ForgotPasswordRequestDto) {
        return this.authService.forgotPassword(forgotPasswordDto);
    }

    // Verify OTP and reset password
    @Post('verify-otp')
    @HttpCode(HttpStatus.NO_CONTENT)
    verifyOtpAndResetPassword(@Body() verifyOtpDto: VerifyOtpAndResetPasswordDto) {
        return this.authService.verifyOtpAndResetPassword(verifyOtpDto);
    }
}
