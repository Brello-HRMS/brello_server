import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  hashValue,
  verifyHash,
  generateOtp,
  calculateOtpExpiration,
} from '../utils';
import { TokenService } from './token.service';
import { UserService } from '../../user/services/user.service';
import { SessionRepository } from '../repositories/session.repository';
import { OtpRepository } from '../repositories/otp.repository';
import {
  RegisterPlatformAdminDto,
  VerifyRegisterPlatformAdminDto,
  LoginPlatformAdminDto,
  VerifyLoginPlatformAdminDto,
} from '../dto/platform-admin.dto';
import { AuthResponseDto } from '../dto/auth-response.dto';
import { OtpPurpose } from '../../../common/enums';
import { Status } from '../../../common/enums';
import { NotificationService } from '../../notification/services/notification.service';
import { NotificationType } from '../../../common/enums/notification-type.enum';

// Service specifically for Platform Admin OTP and Token logic
@Injectable()
export class PlatformAdminAuthService {
  private readonly logger = new Logger(PlatformAdminAuthService.name);

  constructor(
    private readonly userService: UserService,
    private readonly sessionRepository: SessionRepository,
    private readonly otpRepository: OtpRepository,
    private readonly tokenService: TokenService,
    private readonly configService: ConfigService,
    private readonly notificationService: NotificationService,
  ) {}

  async registerPlatformAdmin(
    registerDto: RegisterPlatformAdminDto,
  ): Promise<void> {
    this.logger.log(
      `Platform Admin registration initiated for email: ${registerDto.email}`,
    );

    // Check if a PENDING or ACTIVE user already exists
    const existingUser = await this.userService.findByEmail(registerDto.email);
    if (existingUser && existingUser.status === Status.ACTIVE) {
      // We can return success or throw an error. Usually we pretend it sent an OTP to not leak emails.
      this.logger.warn(
        `Registration attempt for active platform admin: ${registerDto.email}`,
      );
      return;
    }

    let user = existingUser;
    if (!user) {
      // Hash password
      const password_hash = await hashValue(registerDto.password);

      // Create user
      user = await this.userService.createPlatformAdmin(
        registerDto,
        password_hash,
      );
    }

    // Delete any existing OTPs for this user
    await this.otpRepository.deleteByIdentifierAndPurpose(
      registerDto.email,
      OtpPurpose.PLATFORM_ADMIN_REGISTER,
    );

    // Generate OTP
    const otp = generateOtp();
    const otpHash = await hashValue(otp);

    // Store OTP
    await this.otpRepository.create({
      identifier: registerDto.email,
      otp_hash: otpHash,
      user_id: user.id,
      purpose: OtpPurpose.PLATFORM_ADMIN_REGISTER,
      expires_at: calculateOtpExpiration(this.configService),
      attempts_count: 0,
    });

    await this.notificationService.send({
      type: NotificationType.EMAIL,
      target_email: registerDto.email,
      title: 'Platform Admin Registration OTP',
      message: `Your registration OTP is ${otp}. Please use it to activate your admin account.`,
    });
  }

  async verifyRegisterPlatformAdmin(
    verifyDto: VerifyRegisterPlatformAdminDto,
  ): Promise<void> {
    this.logger.log(`Verifying registration OTP for: ${verifyDto.email}`);

    await this.validateAndConsumeOtp(
      verifyDto.email,
      verifyDto.otp,
      OtpPurpose.PLATFORM_ADMIN_REGISTER,
    );

    const user = await this.userService.findByEmail(verifyDto.email);
    if (!user) throw new NotFoundException('User not found');

    await this.userService.update(user.id, {
      status: Status.ACTIVE,
    } as any);

    this.logger.log(`Platform admin ${user.email} successfully activated.`);
  }

  async loginPlatformAdmin(loginDto: LoginPlatformAdminDto): Promise<void> {
    this.logger.log(
      `Platform Admin login initiated for email: ${loginDto.email}`,
    );

    const user = await this.userService.findByEmail(loginDto.email);
    if (
      !user ||
      user.status !== Status.ACTIVE ||
      !user.is_platform_admin
    ) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await verifyHash(
      loginDto.password,
      user.password_hash,
    );
    if (!isPasswordValid)
      throw new UnauthorizedException('Invalid credentials Password');

    // Delete any old login OTPs
    await this.otpRepository.deleteByIdentifierAndPurpose(
      loginDto.email,
      OtpPurpose.PLATFORM_ADMIN_LOGIN,
    );

    // Generate new OTP
    const otp = generateOtp();
    const otpHash = await hashValue(otp);

    // Store OTP
    await this.otpRepository.create({
      identifier: loginDto.email,
      otp_hash: otpHash,
      user_id: user.id,
      purpose: OtpPurpose.PLATFORM_ADMIN_LOGIN,
      expires_at: calculateOtpExpiration(this.configService),
      attempts_count: 0,
    });

    await this.notificationService.send({
      type: NotificationType.EMAIL,
      target_email: loginDto.email,
      title: 'Platform Admin Login OTP',
      message: `Your login OTP is ${otp}. Please use it to access your admin account.`,
    });
  }

  async verifyLoginPlatformAdmin(
    verifyDto: VerifyLoginPlatformAdminDto,
  ): Promise<AuthResponseDto> {
    this.logger.log(`Verifying login OTP for: ${verifyDto.email}`);

    await this.validateAndConsumeOtp(
      verifyDto.email,
      verifyDto.otp,
      OtpPurpose.PLATFORM_ADMIN_LOGIN,
    );

    const user = await this.userService.findByEmail(verifyDto.email);
    if (
      !user ||
      user.status !== Status.ACTIVE ||
      !user.is_platform_admin
    ) {
      throw new UnauthorizedException('Invalid user state');
    }

    const tokens = await this.createSessionAndTokens(user);

    this.logger.log(`Platform Admin logged in successfully: ${user.email}`);

    return {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_in: tokens.expires_in,
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        is_platform_admin: user.is_platform_admin,
      },
      availableApps: [],
      defaultAppId: null as any,
    };
  }

  // Helper methodologies
  private async validateAndConsumeOtp(
    email: string,
    otp: string,
    purpose: OtpPurpose,
  ) {
    const otpRecord = await this.otpRepository.findByIdentifierAndPurpose(
      email,
      purpose,
    );

    if (!otpRecord) throw new BadRequestException('Invalid or expired OTP');
    if (new Date() > otpRecord.expires_at) {
      await this.otpRepository.delete(otpRecord.id);
      throw new BadRequestException('OTP has expired');
    }

    const isDevBypass =
      this.configService.get<string>('brello.environment') === 'dev' &&
      otp === '123456';
    const isOtpValid =
      isDevBypass || (await verifyHash(otp, otpRecord.otp_hash));
    if (!isOtpValid) {
      await this.otpRepository.incrementAttempts(otpRecord.id);
      throw new BadRequestException('Invalid OTP');
    }

    await this.otpRepository.delete(otpRecord.id);
  }

  private async createSessionAndTokens(user: any) {
    return this.tokenService.createSessionAndTokens({
      userId: user.id,
      organizationId: user.organization_id,
      enterpriseId: user.enterprise_id,
      isPlatformAdmin: true,
      deviceFingerprint: 'Platform Admin Session',
    });
  }
}
