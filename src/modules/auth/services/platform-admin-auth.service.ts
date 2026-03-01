import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
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
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { OtpPurpose } from '../../../common/enums';
import { Status } from '../../../common/enums';
import { NotificationService } from '../../notification/services/notification.service';
import { NotificationType } from '../../../common/enums/notification-type.enum';

// Service specifically for Platform Admin OTP and Token logic
@Injectable()
export class PlatformAdminAuthService {
  private readonly logger = new Logger(PlatformAdminAuthService.name);
  private readonly SALT_ROUNDS = 10;

  constructor(
    private readonly userService: UserService,
    private readonly sessionRepository: SessionRepository,
    private readonly otpRepository: OtpRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly notificationService: NotificationService,
  ) {}

  // Generate access token
  private generateAccessToken(payload: JwtPayload): string {
    const plainPayload = { ...payload };
    const expiresIn =
      this.configService.get<string>('auth.JWT_ACCESS_EXPIRATION') ?? '15m';
    return this.jwtService.sign(plainPayload, {
      secret:
        this.configService.get<string>('auth.JWT_SECRET') || 'default-secret',
      expiresIn: expiresIn as any,
    });
  }

  // Generate refresh token
  private generateRefreshToken(payload: JwtPayload): string {
    const plainPayload = { ...payload };
    const expiresIn =
      this.configService.get<string>('auth.JWT_REFRESH_EXPIRATION') ?? '7d';
    return this.jwtService.sign(plainPayload, {
      secret:
        this.configService.get<string>('auth.JWT_REFRESH_SECRET') ||
        'default-refresh-secret',
      expiresIn: expiresIn as any,
    });
  }

  // Hash a value using bcrypt
  private async hash(value: string): Promise<string> {
    return bcrypt.hash(value, this.SALT_ROUNDS);
  }

  // Verify a value against a hash
  private async verify(value: string, hash: string): Promise<boolean> {
    return bcrypt.compare(value, hash);
  }

  // Generate random OTP
  private generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  // Calculate session expiration date
  private calculateSessionExpiration(): Date {
    const days = this.configService.get<number>('session.expirationDays', 7);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + days);
    return expiresAt;
  }

  // Calculate OTP expiration date
  private calculateOtpExpiration(): Date {
    const defaultMinutes = 10;
    const minutes = this.configService.get<number>(
      'otp.expirationMinutes',
      defaultMinutes,
    );
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + minutes);
    return expiresAt;
  }

  async registerPlatformAdmin(
    registerDto: RegisterPlatformAdminDto,
  ): Promise<void> {
    this.logger.log(
      `Platform Admin registration initiated for email: ${registerDto.email}`,
    );

    // Check if a PENDING or ACTIVE user already exists
    const existingUser = await this.userService.findByEmail(registerDto.email);
    if (existingUser && existingUser.base_status === Status.ACTIVE) {
      // We can return success or throw an error. Usually we pretend it sent an OTP to not leak emails.
      this.logger.warn(
        `Registration attempt for active platform admin: ${registerDto.email}`,
      );
      return;
    }

    let user = existingUser;
    if (!user) {
      // Hash password
      const password_hash = await this.hash(registerDto.password);

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
    const otp = this.generateOtp();
    const otpHash = await this.hash(otp);

    // Store OTP
    await this.otpRepository.create({
      identifier: registerDto.email,
      otp_hash: otpHash,
      user_id: user.id,
      purpose: OtpPurpose.PLATFORM_ADMIN_REGISTER,
      expires_at: this.calculateOtpExpiration(),
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

    // Find OTP
    const otpRecord = await this.otpRepository.findByIdentifierAndPurpose(
      verifyDto.email,
      OtpPurpose.PLATFORM_ADMIN_REGISTER,
    );

    if (!otpRecord) throw new BadRequestException('Invalid or expired OTP');
    if (new Date() > otpRecord.expires_at) {
      await this.otpRepository.delete(otpRecord.id);
      throw new BadRequestException('OTP has expired');
    }

    // Verify OTP
    const isOtpValid = await this.verify(verifyDto.otp, otpRecord.otp_hash);
    if (!isOtpValid) {
      await this.otpRepository.incrementAttempts(otpRecord.id);
      throw new BadRequestException('Invalid OTP');
    }

    // Find user
    const user = await this.userService.findByEmail(verifyDto.email);
    if (!user) throw new NotFoundException('User not found');

    // Activate User by updating status to ACTIVE (using TypeORM repository bypass in userService if necessary, or DTO)
    await this.userService.update(user.id, {
      base_status: Status.ACTIVE,
    } as any);

    // Delete OTP
    await this.otpRepository.delete(otpRecord.id);

    this.logger.log(`Platform admin ${user.email} successfully activated.`);
  }

  async loginPlatformAdmin(loginDto: LoginPlatformAdminDto): Promise<void> {
    this.logger.log(
      `Platform Admin login initiated for email: ${loginDto.email}`,
    );

    const user = await this.userService.findByEmail(loginDto.email);
    if (
      !user ||
      user.base_status !== Status.ACTIVE ||
      !user.is_platform_admin
    ) {
      throw new UnauthorizedException('Invalid credentials');
    }

    console.log(loginDto.password);
    console.log(user.password_hash);

    const isPasswordValid = await this.verify(
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
    const otp = this.generateOtp();
    const otpHash = await this.hash(otp);

    // Store OTP
    await this.otpRepository.create({
      identifier: loginDto.email,
      otp_hash: otpHash,
      user_id: user.id,
      purpose: OtpPurpose.PLATFORM_ADMIN_LOGIN,
      expires_at: this.calculateOtpExpiration(),
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

    // Find OTP
    const otpRecord = await this.otpRepository.findByIdentifierAndPurpose(
      verifyDto.email,
      OtpPurpose.PLATFORM_ADMIN_LOGIN,
    );

    if (!otpRecord) throw new BadRequestException('Invalid or expired OTP');
    if (new Date() > otpRecord.expires_at) {
      await this.otpRepository.delete(otpRecord.id);
      throw new BadRequestException('OTP has expired');
    }

    // Verify OTP
    const isOtpValid = await this.verify(verifyDto.otp, otpRecord.otp_hash);
    if (!isOtpValid) {
      await this.otpRepository.incrementAttempts(otpRecord.id);
      throw new BadRequestException('Invalid OTP');
    }

    // Find and validate User
    const user = await this.userService.findByEmail(verifyDto.email);
    if (
      !user ||
      user.base_status !== Status.ACTIVE ||
      !user.is_platform_admin
    ) {
      throw new UnauthorizedException('Invalid user state');
    }

    // ── Generate Refresh Token & Hash ──
    const refreshToken = Math.random().toString(36).substring(2);
    const refreshTokenHash = await this.hash(refreshToken);

    // Process Login (Session, JWT)
    const session = await this.sessionRepository.create({
      user_id: user.id,
      refresh_token_hash: refreshTokenHash,
      device_fingerprint: 'Platform Admin Session', // Mock standard request data
      login_time: new Date(),
      last_activity: new Date(),
      expires_at: this.calculateSessionExpiration(),
    });

    // Generate tokens
    const jwtPayload: JwtPayload = {
      userId: user.id,
      sessionId: session.id,
      organizationId: user.organization_id as any,
      enterpriseId: user.enterprise_id as any,
      isPlatformAdmin: true,
      appId: null as any,
    };

    const access_token = this.generateAccessToken(jwtPayload);
    const refresh_token = this.generateRefreshToken({
      ...jwtPayload,
      refreshToken,
    });

    // Delete OTP
    await this.otpRepository.delete(otpRecord.id);

    this.logger.log(`Platform Admin logged in successfully: ${user.email}`);

    return {
      access_token,
      refresh_token,
      expires_in: 900, // 15 minutes in seconds
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
}
