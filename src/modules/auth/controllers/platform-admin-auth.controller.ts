import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Res,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import * as express from 'express';
import { PlatformAdminAuthService } from '../services/platform-admin-auth.service';
import { CookieService } from '../services/cookie.service';
import {
  RegisterPlatformAdminDto,
  VerifyRegisterPlatformAdminDto,
  LoginPlatformAdminDto,
  VerifyLoginPlatformAdminDto,
} from '../dto/platform-admin.dto';

// Controller specifically for handling Platform Admin authentication flows
@ApiTags('Platform Admin Authentication')
@Controller('auth/platform-admin')
export class PlatformAdminAuthController {
  constructor(
    private readonly platformAdminAuthService: PlatformAdminAuthService,
    private readonly cookieService: CookieService,
  ) { }

  // 1. Register Platform Admin (Sends OTP)
  @Post('register')
  @HttpCode(HttpStatus.OK)
  registerPlatformAdmin(@Body() registerDto: RegisterPlatformAdminDto) {
    return this.platformAdminAuthService.registerPlatformAdmin(registerDto);
  }

  // 2. Verify Registration OTP (Activates Account)
  @Post('verify-register')
  @HttpCode(HttpStatus.OK)
  verifyRegisterPlatformAdmin(
    @Body() verifyDto: VerifyRegisterPlatformAdminDto,
  ) {
    return this.platformAdminAuthService.verifyRegisterPlatformAdmin(verifyDto);
  }

  // 3. Login Platform Admin (Sends OTP)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  loginPlatformAdmin(@Body() loginDto: LoginPlatformAdminDto) {
    return this.platformAdminAuthService.loginPlatformAdmin(loginDto);
  }

  // 4. Verify Login OTP (Returns JWT + sets refresh cookie)
  @Post('verify-login')
  @HttpCode(HttpStatus.OK)
  async verifyLoginPlatformAdmin(
    @Body() verifyDto: VerifyLoginPlatformAdminDto,
    @Res({ passthrough: true }) res: express.Response,
  ) {
    const result =
      await this.platformAdminAuthService.verifyLoginPlatformAdmin(verifyDto);

    if (result.refresh_token) {
      this.cookieService.setRefreshTokenCookie(res, result.refresh_token);
    }

    const { refresh_token, ...responseBody } = result;
    return responseBody;
  }
}
