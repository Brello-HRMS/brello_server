import {
  Controller,
  Get,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Res,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
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
import { ResendOtpDto } from '../dto/resend-otp.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { JwtRefreshAuthGuard } from '../guards/jwt-refresh-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { LoggedInUser } from '../../../common/decorators/logged-in-user.decorator';
import type { LoggedInUser as LoggedInUserInterface } from '../interfaces/logged-in-user.interface';
import type { JwtPayload } from '../interfaces/jwt-payload.interface';

@ApiTags('Authentication')
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
    @Req() req: express.Request,
  ) {
    const context = { ip: req.ip, userAgent: req.headers['user-agent'] as string };
    const result = await this.authService.loginWithPassword(loginDto, context);

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
    @Req() req: express.Request,
  ) {
    const context = { ip: req.ip, userAgent: req.headers['user-agent'] as string };
    const result = await this.authService.loginWithOtp(dto, context);

    if (result.refresh_token) {
      this.cookieService.setRefreshTokenCookie(res, result.refresh_token);
    }

    const { refresh_token, ...responseBody } = result;
    return responseBody;
  }

  @Get('apps')
  @UseGuards(JwtAuthGuard)
  getAvailableApps(@CurrentUser() user: JwtPayload) {
    return this.authService.getAvailableAppsForUser(
      user.userId,
      user.organizationId,
      user.isPlatformAdmin,
    );
  }

  @Post('switch-app')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  switchApp(
    @CurrentUser() user: JwtPayload,
    @Body() switchAppDto: SwitchAppDto,
  ) {
    return this.authService.switchApp(user as any, switchAppDto);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @CurrentUser() user: JwtPayload,
    @Res({ passthrough: true }) res: express.Response,
    @Req() req: express.Request,
  ) {
    const context = { ip: req.ip, userAgent: req.headers['user-agent'] as string };
    await this.authService.logout(user.sessionId, user.userId, context, user.enterpriseId, user.organizationId);
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

  @Post('resend-otp')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Resend OTP for a given soul/purpose' })
  resendOtp(@Body() resendOtpDto: ResendOtpDto) {
    return this.authService.resendOtp(resendOtpDto);
  }
}
