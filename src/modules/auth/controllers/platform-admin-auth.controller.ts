import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { PlatformAdminAuthService } from '../services/platform-admin-auth.service';
import {
  RegisterPlatformAdminDto,
  VerifyRegisterPlatformAdminDto,
  LoginPlatformAdminDto,
  VerifyLoginPlatformAdminDto,
} from '../dto/platform-admin.dto';

// Controller specifically for handling Platform Admin authentication flows
@Controller('auth/platform-admin')
export class PlatformAdminAuthController {
  constructor(
    private readonly platformAdminAuthService: PlatformAdminAuthService,
  ) {}

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

  // 4. Verify Login OTP (Returns JWT)
  @Post('verify-login')
  @HttpCode(HttpStatus.OK)
  verifyLoginPlatformAdmin(@Body() verifyDto: VerifyLoginPlatformAdminDto) {
    return this.platformAdminAuthService.verifyLoginPlatformAdmin(verifyDto);
  }
}
