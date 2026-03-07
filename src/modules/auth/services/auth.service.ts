import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { UserService } from '../../user/services/user.service';
import { SessionRepository } from '../repositories/session.repository';
import { OtpRepository } from '../repositories/otp.repository';
import { LoginDto } from '../dto/login.dto';
import { SwitchAppDto } from '../dto/switch-app.dto';
import { UpdatePasswordDto } from '../dto/update-password.dto';
import {
  ForgotPasswordRequestDto,
  VerifyOtpAndResetPasswordDto,
} from '../dto/forgot-password.dto';
import {
  AuthResponseDto,
  RefreshTokenResponseDto,
  SwitchAppResponseDto,
} from '../dto/auth-response.dto';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { OtpPurpose } from '../../../common/enums';
import { UserRoleMap } from '../../rbac/entities/user-role-map.entity';
import { App } from '../../app/entities/app.entity';
import { Status } from '../../../common/enums';

// Auth Service - Implements comprehensive authentication and authorization logic
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly SALT_ROUNDS = 10;
  private readonly OTP_LENGTH = 6;

  constructor(
    private readonly userService: UserService,
    private readonly sessionRepository: SessionRepository,
    private readonly otpRepository: OtpRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @InjectRepository(UserRoleMap)
    private readonly userRoleMapRepository: Repository<UserRoleMap>,
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
    const minutes = this.configService.get<number>('otp.expirationMinutes', 10);
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + minutes);
    return expiresAt;
  }

  // Login user
  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    this.logger.log(`Login attempt for email: ${loginDto.email}`);

    const user = await this.validateCredentials(
      loginDto.email,
      loginDto.password,
    );
    const availableApps = await this.getUserAvailableApps(
      user.id,
      user.organization_id,
      user.is_platform_admin,
    );
    const defaultAppId = this.determineDefaultApp(
      user.last_access_app_id,
      availableApps,
    );

    const tokens = await this.createSessionAndTokens({
      userId: user.id,
      organizationId: user.organization_id,
      enterpriseId: user.enterprise_id,
      isPlatformAdmin: user.is_platform_admin,
      deviceFingerprint: loginDto.device_fingerprint,
      appId: defaultAppId,
    });

    this.logger.log(`User ${user.id} logged in. Default app: ${defaultAppId}`);

    return {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        enterprise_id: user.enterprise_id,
        organization_id: user.organization_id,
      },
      expires_in: tokens.expires_in,
      defaultAppId,
      availableApps,
    };
  }

  // Helper methodologies for login
  private async validateCredentials(email: string, password: string) {
    const user = await this.userService.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.base_status !== Status.ACTIVE) {
      throw new UnauthorizedException(
        'Account is inactive. Contact your administrator.',
      );
    }

    const isPasswordValid = await this.userService.verifyPassword(
      password,
      user.password_hash,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return user;
  }

  private async getUserAvailableApps(
    userId: string,
    organizationId: string,
    isPlatformAdmin: boolean,
  ) {
    const userRoleMaps = await this.userRoleMapRepository
      .createQueryBuilder('urm')
      .innerJoinAndSelect('urm.role', 'role')
      .innerJoinAndSelect('role.app', 'app')
      .where('urm.user_id = :userId', { userId })
      .andWhere('urm.organization_id = :orgId', { orgId: organizationId })
      .andWhere('role.status = :roleStatus', { roleStatus: Status.ACTIVE })
      .andWhere('app.status = :appStatus', { appStatus: Status.ACTIVE })
      .getMany();

    if (!userRoleMaps.length && !isPlatformAdmin) {
      throw new ForbiddenException(
        'No active roles assigned. Contact your administrator.',
      );
    }

    const appMap = new Map<
      string,
      { id: string; name: string; priority: number }
    >();
    for (const urm of userRoleMaps) {
      const app = urm.role.app;
      if (!appMap.has(app.id)) {
        appMap.set(app.id, {
          id: app.id,
          name: app.name,
          priority: app.priority,
        });
      }
    }
    return [...appMap.values()].sort((a, b) => a.priority - b.priority);
  }

  private determineDefaultApp(
    lastAccessAppId: string | null,
    availableApps: { id: string; name: string; priority: number }[],
  ) {
    if (
      lastAccessAppId &&
      availableApps.some((app) => app.id === lastAccessAppId)
    ) {
      return lastAccessAppId;
    }
    return availableApps.length > 0 ? availableApps[0].id : '';
  }

  private async createSessionAndTokens(params: {
    userId: string;
    organizationId: string;
    enterpriseId: string;
    isPlatformAdmin: boolean;
    deviceFingerprint?: string;
    appId: string;
  }) {
    const refreshToken = Math.random().toString(36).substring(2);
    const refreshTokenHash = await this.hash(refreshToken);

    const session = await this.sessionRepository.create({
      user_id: params.userId,
      refresh_token_hash: refreshTokenHash,
      device_fingerprint: params.deviceFingerprint || 'unknown',
      login_time: new Date(),
      last_activity: new Date(),
      expires_at: this.calculateSessionExpiration(),
      app_id: params.appId,
    });

    const tokenPayload: JwtPayload = {
      userId: params.userId,
      sessionId: session.id,
      organizationId: params.organizationId,
      enterpriseId: params.enterpriseId,
      appId: params.appId,
      isPlatformAdmin: params.isPlatformAdmin,
    };

    return {
      access_token: this.generateAccessToken(tokenPayload),
      refresh_token: this.generateRefreshToken({
        ...tokenPayload,
        refreshToken,
      }),
      expires_in: 900,
    };
  }

  // Switch active application
  async switchApp(
    currentUser: JwtPayload,
    switchAppDto: SwitchAppDto,
  ): Promise<SwitchAppResponseDto> {
    this.logger.log(
      `App switch: user ${currentUser.userId} → app ${switchAppDto.appId}`,
    );

    // Validate the user has at least one active role in the requested app
    const hasRole = await this.userRoleMapRepository
      .createQueryBuilder('urm')
      .innerJoin('urm.role', 'role')
      .innerJoin('role.app', 'app')
      .where('urm.user_id = :userId', { userId: currentUser.userId })
      .andWhere('urm.organization_id = :orgId', {
        orgId: currentUser.organizationId,
      })
      .andWhere('app.id = :appId', { appId: switchAppDto.appId })
      .andWhere('role.status = :roleStatus', { roleStatus: Status.ACTIVE })
      .andWhere('app.status = :appStatus', { appStatus: Status.ACTIVE })
      .getCount();

    if (!hasRole && !currentUser.isPlatformAdmin) {
      throw new ForbiddenException(
        'You do not have access to the requested application.',
      );
    }

    // Persist the last accessed app
    await this.userService.update(currentUser.userId, {
      last_access_app_id: switchAppDto.appId,
    } as any);

    // Issue a fresh access token scoped to the new app
    const newPayload: JwtPayload = {
      ...currentUser,
      appId: switchAppDto.appId,
    };

    const accessToken = this.generateAccessToken(newPayload);

    this.logger.log(
      `App switched successfully: ${currentUser.userId} → ${switchAppDto.appId}`,
    );

    return {
      access_token: accessToken,
      appId: switchAppDto.appId,
      expires_in: 900,
    };
  }

  // Logout user
  async logout(sessionId: string): Promise<void> {
    this.logger.log(`Logout for session: ${sessionId}`);

    const session = await this.sessionRepository.findById(sessionId);
    if (!session) {
      throw new NotFoundException('Session not found');
    }

    await this.sessionRepository.logout(sessionId);
    this.logger.log(`User logged out successfully: ${sessionId}`);
  }

  // Refresh access token
  async refreshToken(payload: JwtPayload): Promise<RefreshTokenResponseDto> {
    this.logger.log(`Token refresh for session: ${payload.sessionId}`);

    // Find session
    const session = await this.sessionRepository.findById(payload.sessionId);
    if (!session) {
      throw new UnauthorizedException('Invalid session');
    }

    // Check if session is logged out
    if (session.logout_time) {
      throw new UnauthorizedException('Session has been logged out');
    }

    // Check if session is expired
    if (new Date() > session.expires_at) {
      throw new UnauthorizedException('Session has expired');
    }

    // Verify refresh token
    if (!payload.refreshToken) {
      throw new UnauthorizedException('Invalid refresh token payload');
    }
    const isRefreshTokenValid = await this.verify(
      payload.refreshToken,
      session.refresh_token_hash,
    );
    if (!isRefreshTokenValid) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Generate new refresh token (token rotation)
    const newRefreshToken = Math.random().toString(36).substring(2);
    const newRefreshTokenHash = await this.hash(newRefreshToken);

    // Update session
    await this.sessionRepository.update(payload.sessionId, {
      refresh_token_hash: newRefreshTokenHash,
      last_activity: new Date(),
    });

    // Generate new JWT tokens
    const newPayload: JwtPayload = {
      userId: payload.userId,
      sessionId: payload.sessionId,
      organizationId: payload.organizationId,
      enterpriseId: payload.enterpriseId,
      appId: payload.appId,
      isPlatformAdmin: payload.isPlatformAdmin,
    };

    const accessToken = this.generateAccessToken(newPayload);
    const refreshTokenJwt = this.generateRefreshToken({
      ...newPayload,
      refreshToken: newRefreshToken,
    });

    this.logger.log(`Token refreshed successfully: ${payload.sessionId}`);

    return {
      access_token: accessToken,
      refresh_token: refreshTokenJwt,
      expires_in: 900, // 15 minutes in seconds
    };
  }

  // Update user password
  async updatePassword(
    userId: string,
    updatePasswordDto: UpdatePasswordDto,
  ): Promise<void> {
    this.logger.log(`Password update for user: ${userId}`);

    // Get user
    const user = await this.userService.findOne(userId);

    // Verify old password
    const isOldPasswordValid = await this.userService.verifyPassword(
      updatePasswordDto.old_password,
      user.password_hash,
    );
    if (!isOldPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    // Hash new password
    const newPasswordHash = await this.hash(updatePasswordDto.new_password);

    // Update user
    await this.userService.update(userId, {
      // @ts-ignore - password_hash is not in UpdateUserDto but we need to update it
      password_hash: newPasswordHash,
    });

    // Invalidate all sessions (force re-login for security)
    await this.sessionRepository.deleteAllUserSessions(userId);

    this.logger.log(`Password updated successfully: ${userId}`);
  }

  // Initiate forgot password flow
  async forgotPassword(
    forgotPasswordDto: ForgotPasswordRequestDto,
  ): Promise<void> {
    this.logger.log(`Forgot password for email: ${forgotPasswordDto.email}`);

    // Find user
    const user = await this.userService.findByEmail(forgotPasswordDto.email);
    if (!user) {
      // Don't reveal if email exists (security best practice)
      this.logger.warn(
        `Forgot password attempt for non-existent email: ${forgotPasswordDto.email}`,
      );
      return;
    }

    // Delete any existing OTPs for this user
    await this.otpRepository.deleteByIdentifierAndPurpose(
      forgotPasswordDto.email,
      OtpPurpose.RESET_PASSWORD,
    );

    // Generate OTP
    const otp = this.generateOtp();
    const otpHash = await this.hash(otp);

    // Store OTP
    await this.otpRepository.create({
      identifier: forgotPasswordDto.email,
      otp_hash: otpHash,
      user_id: user.id,
      purpose: OtpPurpose.RESET_PASSWORD,
      expires_at: this.calculateOtpExpiration(),
      attempts_count: 0,
    });

    // TODO: Send OTP via email
    // For now, log it (REMOVE IN PRODUCTION!)
    this.logger.warn(`OTP for ${forgotPasswordDto.email}: ${otp}`);

    this.logger.log(`OTP generated for password reset: ${user.id}`);
  }

  // Verify OTP and reset password
  async verifyOtpAndResetPassword(
    verifyOtpDto: VerifyOtpAndResetPasswordDto,
  ): Promise<void> {
    this.logger.log(`OTP verification for email: ${verifyOtpDto.email}`);

    // Find OTP
    const otpRecord = await this.otpRepository.findByIdentifierAndPurpose(
      verifyOtpDto.email,
      OtpPurpose.RESET_PASSWORD,
    );

    if (!otpRecord) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    // Check expiration
    if (new Date() > otpRecord.expires_at) {
      await this.otpRepository.delete(otpRecord.id);
      throw new BadRequestException('OTP has expired');
    }

    // Check attempts
    const maxAttempts = this.configService.get<number>('otp.maxAttempts', 5);
    if (otpRecord.attempts_count >= maxAttempts) {
      await this.otpRepository.delete(otpRecord.id);
      throw new BadRequestException('Maximum OTP attempts exceeded');
    }

    // Verify OTP
    const isOtpValid = await this.verify(verifyOtpDto.otp, otpRecord.otp_hash);
    if (!isOtpValid) {
      // Increment attempts
      await this.otpRepository.incrementAttempts(otpRecord.id);
      throw new BadRequestException('Invalid OTP');
    }

    // Find user
    const user = await this.userService.findByEmail(verifyOtpDto.email);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Hash new password
    const newPasswordHash = await this.hash(verifyOtpDto.new_password);

    // Update user
    await this.userService.update(user.id, {
      // @ts-ignore
      password_hash: newPasswordHash,
    });

    // Delete OTP
    await this.otpRepository.delete(otpRecord.id);

    // Invalidate all sessions
    await this.sessionRepository.deleteAllUserSessions(user.id);

    this.logger.log(`Password reset successfully: ${user.id}`);
  }
}
