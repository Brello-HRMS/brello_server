import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Res,
} from '@nestjs/common';
import * as express from 'express';
import { AuthService } from '../services/auth.service';
import { CookieService } from '../services/cookie.service';
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
import type { JwtPayload } from '../interfaces/jwt-payload.interface';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly cookieService: CookieService,
  ) { }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async loginWithPassword(
    @Body() loginDto: LoginPasswordDto,
    @Res({ passthrough: true }) res: express.Response,
  ) {
    const result = await this.authService.loginWithPassword(loginDto);

    if (result.refresh_token) {
      this.cookieService.setRefreshTokenCookie(res, result.refresh_token);
    }

    const { refresh_token, ...responseBody } = result;
    return responseBody;
  }

  @Post('login/send-otp')
  @HttpCode(HttpStatus.NO_CONTENT)
  loginSendOtp(@Body() dto: LoginOtpDto) {
    return this.authService.loginSendOtp(dto);
  }

  @Post('login/verify-otp')
  @HttpCode(HttpStatus.OK)
  async loginWithOtp(
    @Body() dto: VerifyLoginOtpDto,
    @Res({ passthrough: true }) res: express.Response,
  ) {
    const result = await this.authService.loginWithOtp(dto);

    if (result.refresh_token) {
      this.cookieService.setRefreshTokenCookie(res, result.refresh_token);
    }

    const { refresh_token, ...responseBody } = result;
    return responseBody;
  }

  @Post('switch-app')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  switchApp(
    @CurrentUser() user: JwtPayload,
    @Body() switchAppDto: SwitchAppDto,
  ) {
    return this.authService.switchApp(user, switchAppDto);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @CurrentUser() user: JwtPayload,
    @Res({ passthrough: true }) res: express.Response,
  ) {
    await this.authService.logout(user.sessionId);
    this.cookieService.clearRefreshTokenCookie(res);
  }

  @Post('refresh')
  @UseGuards(JwtRefreshAuthGuard)
  @HttpCode(HttpStatus.OK)
  async refresh(
    @CurrentUser() user: JwtPayload,
    @Res({ passthrough: true }) res: express.Response,
  ) {
    const result = await this.authService.refreshToken(user);

    this.cookieService.setRefreshTokenCookie(res, result.refresh_token);

    const { refresh_token, ...responseBody } = result;
    return responseBody;
  }

  @Post('update-password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  updatePassword(
    @CurrentUser() user: JwtPayload,
    @Body() updatePasswordDto: UpdatePasswordDto,
  ) {
    return this.authService.updatePassword(user.userId, updatePasswordDto);
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
