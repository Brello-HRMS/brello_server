import {
  Controller,
  Post,
  Body,
  Get,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from '../services/auth.service';
import {
  LoginOtpDto,
  LoginPasswordDto,
  VerifyLoginOtpDto,
} from '../dto/login.dto';
import { SwitchAppDto } from '../dto/switch-app.dto';
import { UpdatePasswordDto } from '../dto/update-password.dto';
import {
  ForgotPasswordRequestDto,
  VerifyOtpAndResetPasswordDto,
} from '../dto/forgot-password.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { JwtRefreshAuthGuard } from '../guards/jwt-refresh-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { LoggedInUser } from '../../../common/decorators/logged-in-user.decorator';
import type { LoggedInUser as LoggedInUserInterface } from '../interfaces/logged-in-user.interface';
import type { JwtPayload } from '../interfaces/jwt-payload.interface';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  loginWithPassword(@Body() loginDto: LoginPasswordDto) {
    return this.authService.loginWithPassword(loginDto);
  }

  @Post('login/send-otp')
  @HttpCode(HttpStatus.NO_CONTENT)
  loginSendOtp(@Body() dto: LoginOtpDto) {
    return this.authService.loginSendOtp(dto);
  }

  @Post('login/verify-otp')
  @HttpCode(HttpStatus.OK)
  loginWithOtp(@Body() dto: VerifyLoginOtpDto) {
    return this.authService.loginWithOtp(dto);
  }

  @Post('switch-app')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  switchApp(
    @LoggedInUser() user: LoggedInUserInterface,
    @Body() switchAppDto: SwitchAppDto,
  ) {
    return this.authService.switchApp(user, switchAppDto);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@CurrentUser() user: JwtPayload) {
    return this.authService.logout(user.sessionId);
  }

  @Post('refresh')
  @UseGuards(JwtRefreshAuthGuard)
  @HttpCode(HttpStatus.OK)
  refresh(@CurrentUser() user: JwtPayload) {
    return this.authService.refreshToken(user);
  }

  @Post('update-password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  updatePassword(
    @LoggedInUser() user: LoggedInUserInterface,
    @Body() updatePasswordDto: UpdatePasswordDto,
  ) {
    return this.authService.updatePassword(user, updatePasswordDto);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  forgotPassword(@Body() forgotPasswordDto: ForgotPasswordRequestDto) {
    return this.authService.forgotPassword(forgotPasswordDto);
  }

  @Post('verify-otp')
  @HttpCode(HttpStatus.NO_CONTENT)
  verifyOtpAndResetPassword(
    @Body() verifyOtpDto: VerifyOtpAndResetPasswordDto,
  ) {
    return this.authService.verifyOtpAndResetPassword(verifyOtpDto);
  }
}
