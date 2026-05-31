import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  hashValue,
  verifyHash,
  generateOtp,
  calculateOtpExpiration,
  determineDefaultApp,
} from '../utils';
import { TokenService } from './token.service';
import { UserService } from '../../user/services/user.service';
import { EmployeeService } from '../../user/services/employee.service';
import { EmployeeStatus } from '../../user/enums/user.enum';
import { SessionRepository } from '../repositories/session.repository';
import { OtpRepository } from '../repositories/otp.repository';
import {
  LoginPasswordDto,
  LoginOtpDto,
  VerifyLoginOtpDto,
} from '../dto/login.dto';
import { UpdatePasswordDto } from '../dto/update-password.dto';
import {
  ForgotPasswordRequestDto,
  VerifyOtpAndResetPasswordDto,
} from '../dto/forgot-password.dto';
import { ResendOtpDto } from '../dto/resend-otp.dto';
import {
  AuthResponseDto,
  RefreshTokenResponseDto,
  SwitchAppResponseDto,
} from '../dto/auth-response.dto';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { LoggedInUser } from '../../auth/interfaces/logged-in-user.interface';
import { OtpPurpose } from '../../../common/enums';
import { UserRoleMap } from '../../rbac/entities/user-role-map.entity';
import { App } from '../../app/entities/app.entity';
import { Status } from '../../../common/enums';
import { NotificationService } from '../../notification/services/notification.service';
import { NotificationType } from '../../../common/enums/notification-type.enum';
import { getUserAvailableApps } from '../utils/app.util';
import { SwitchAppDto } from '../dto/switch-app.dto';

// Auth Service - Implements comprehensive authentication and authorization logic
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly userService: UserService,
    private readonly sessionRepository: SessionRepository,
    private readonly otpRepository: OtpRepository,
    private readonly tokenService: TokenService,
    private readonly configService: ConfigService,
    @InjectRepository(UserRoleMap)
    private readonly userRoleMapRepository: Repository<UserRoleMap>,
    private readonly notificationService: NotificationService,
    private readonly employeeService: EmployeeService,
  ) {}

  // ---------- Password Login Flow ----------

  async loginWithPassword(
    loginDto: LoginPasswordDto,
  ): Promise<AuthResponseDto> {
    this.logger.log(`Password login attempt for email: ${loginDto.email}`);

    const user = await this.findActiveUserByEmail(loginDto.email);
    await this.validatePassword(loginDto.password, user.password_hash);

    const isSetupRequired = !user.organization_id && !user.is_platform_admin;

    return this.buildAuthResponse(
      user,
      loginDto.device_fingerprint,
      isSetupRequired,
    );
  }

  // ---------- OTP Login Flow ----------

  async loginSendOtp(dto: LoginOtpDto): Promise<void> {
    this.logger.log(`OTP login request for email: ${dto.email}`);

    const user = await this.findActiveUserByEmail(dto.email);

    await this.otpRepository.deleteByIdentifierAndPurpose(
      dto.email,
      OtpPurpose.LOGIN,
    );

    const otp = generateOtp();
    const otpHash = await hashValue(otp);

    await this.otpRepository.create({
      identifier: dto.email,
      otp_hash: otpHash,
      user_id: user.id,
      purpose: OtpPurpose.LOGIN,
      expires_at: calculateOtpExpiration(this.configService),
      attempts_count: 0,
    });

    this.notificationService.send({
      user_id: user.id,
      target_email: dto.email,
      title: 'Your Login OTP',
      message: `Your one-time password is: ${otp}. It will expire in ${this.configService.get<number>('otp.expirationMinutes', 10)} minutes.`,
      type: NotificationType.EMAIL,
    });

    this.logger.log(`Login OTP sent to ${dto.email}`);
  }

  async loginWithOtp(dto: VerifyLoginOtpDto): Promise<AuthResponseDto> {
    this.logger.log(`OTP verification for login: ${dto.email}`);

    let user = await this.findActiveUserByEmail(dto.email);

    const otpRecord = await this.otpRepository.findByIdentifierAndPurpose(
      dto.email,
      OtpPurpose.LOGIN,
    );

    if (!otpRecord) {
      throw new BadRequestException('No OTP found. Please request a new one.');
    }

    if (new Date() > otpRecord.expires_at) {
      await this.otpRepository.delete(otpRecord.id);
      throw new BadRequestException(
        'OTP has expired. Please request a new one.',
      );
    }

    const maxAttempts = this.configService.get<number>('otp.maxAttempts', 5);
    if (otpRecord.attempts_count >= maxAttempts) {
      await this.otpRepository.delete(otpRecord.id);
      throw new BadRequestException(
        'Maximum OTP attempts exceeded. Please request a new one.',
      );
    }

    const isDevBypass =
      this.configService.get<string>('brello.environment') === 'dev' &&
      dto.otp === '123456';
    const isOtpValid =
      isDevBypass || (await verifyHash(dto.otp, otpRecord.otp_hash));
    if (!isOtpValid) {
      await this.otpRepository.incrementAttempts(otpRecord.id);
      throw new BadRequestException('Invalid OTP');
    }

    await this.otpRepository.delete(otpRecord.id);

    // First-login auto-activation: an INVITED employee's user.status is still
    // PENDING. Verifying their OTP proves email ownership, so flip them to
    // ACTIVE before issuing tokens.
    if (user.status === Status.PENDING) {
      try {
        await this.employeeService.activateEmployee(user.id, user.id);
        const refreshed = await this.userService.findByEmail(dto.email);
        if (refreshed) user = refreshed;
      } catch (err) {
        this.logger.warn(
          `Auto-activation failed for ${dto.email}: ${(err as Error).message}`,
        );
      }
    }

    const isSetupRequired = !user.organization_id && !user.is_platform_admin;

    return this.buildAuthResponse(
      user,
      dto.device_fingerprint,
      isSetupRequired,
    );
  }

  // ---------- Shared Auth Helpers ----------

  private async findActiveUserByEmail(email: string) {
    const user = await this.userService.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.status === Status.ACTIVE) {
      return user;
    }

    // Invited employees haven't been activated yet (user.status is PENDING),
    // but they should be allowed to log in for the first time. The first
    // successful login auto-activates them in loginWithOtp.
    if (user.status === Status.PENDING && user.user_profile_id) {
      const profile = await this.employeeService.findProfileByUserId(user.id);
      if (profile?.employee_status === EmployeeStatus.INVITED) {
        return user;
      }
    }

    throw new UnauthorizedException(
      'Account is inactive. Contact your administrator.',
    );
  }

  private async validatePassword(
    plainPassword: string,
    passwordHash: string,
  ): Promise<void> {
    const isValid = await this.userService.verifyPassword(
      plainPassword,
      passwordHash,
    );
    if (!isValid) {
      throw new UnauthorizedException('Invalid email or password');
    }
  }

  async buildAuthResponse(
    user: any,
    deviceFingerprint?: string,
    isSetupRequired: boolean = false,
  ): Promise<AuthResponseDto> {
    let availableApps: { id: string; name: string; priority: number }[] = [];
    let defaultAppId = null as any;

    if (!isSetupRequired) {
      availableApps = await getUserAvailableApps(
        user.id,
        user.organization_id,
        user.is_platform_admin,
        this.userRoleMapRepository,
      );
      defaultAppId = determineDefaultApp(
        user.last_access_app_id,
        availableApps,
      );
    }

    const tokens = await this.tokenService.createSessionAndTokens({
      userId: user.id,
      organizationId: user.organization_id,
      enterpriseId: user.enterprise_id,
      isPlatformAdmin: user.is_platform_admin,
      deviceFingerprint,
      appId: defaultAppId,
    });

    this.logger.log(`User ${user.id} logged in. Default app: ${defaultAppId}. EntID: ${user.enterprise_id}, OrgID: ${user.organization_id}`);

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
        is_platform_admin: user.is_platform_admin,
      },
      expires_in: tokens.expires_in,
      defaultAppId: defaultAppId || '',
      availableApps,
      ...(isSetupRequired && { setup_required: true }),
    };
  }

  async switchApp(
    loggedInUser: JwtPayload,
    switchAppDto: SwitchAppDto,
  ): Promise<SwitchAppResponseDto> {
    this.logger.log(
      `App switch: user ${loggedInUser.userId} → app ${switchAppDto.appId}`,
    );

    // Validate the user has at least one active role in the requested app
    const hasRole = await this.userRoleMapRepository
      .createQueryBuilder('urm')
      .innerJoin('urm.role', 'role')
      .innerJoin('role.app', 'app')
      .where('urm.user_id = :userId', { userId: loggedInUser.userId })
      .andWhere('urm.organization_id = :orgId', {
        orgId: loggedInUser.organizationId,
      })
      .andWhere('app.id = :appId', { appId: switchAppDto.appId })
      .andWhere('role.status = :roleStatus', { roleStatus: Status.ACTIVE })
      .andWhere('app.status = :appStatus', { appStatus: Status.ACTIVE })
      .getCount();

    if (!hasRole && !loggedInUser.isPlatformAdmin) {
      throw new ForbiddenException(
        'You do not have access to the requested application.',
      );
    }

    await this.userService.update(
      loggedInUser.userId,
      {
        last_access_app_id: switchAppDto.appId,
      } as any,
      loggedInUser,
    );

    // For switching app, we need the original payload fields too, but we mainly need userId, sessId, orgId, enterpriseId, isPlatformAdmin
    // Since switchApp is called from controller with JwtPayload converted to LoggedInUser,
    // we might need to be careful if we need SESSION ID here for generating NEW token.
    // Wait, switchApp in controller receives BOTH CurrentUser (JwtPayload) and LoggedInUser? No, I'll change it to LoggedInUser.
    // But then I need sessionId for buildAuthResponse? No, switchApp returns access_token only.

    const accessToken = this.tokenService.generateAccessToken({
      userId: loggedInUser.userId,
      sessionId: loggedInUser.sessionId,
      organizationId: loggedInUser.organizationId,
      enterpriseId: loggedInUser.enterpriseId,
      appId: switchAppDto.appId,
      isPlatformAdmin: loggedInUser.isPlatformAdmin,
    });

    this.logger.log(
      `App switched successfully: ${loggedInUser.userId} → ${switchAppDto.appId}`,
    );

    return {
      access_token: accessToken,
      appId: switchAppDto.appId,
      expires_in: 900,
    };
  }

  async logout(sessionId: string): Promise<void> {
    this.logger.log(`Logout for session: ${sessionId}`);

    const session = await this.sessionRepository.findById(sessionId);
    if (!session) {
      throw new NotFoundException('Session not found');
    }

    await this.sessionRepository.logout(sessionId);
    this.logger.log(`User logged out successfully: ${sessionId}`);
  }

  async refreshToken(payload: JwtPayload): Promise<RefreshTokenResponseDto> {
    this.logger.log(`Token refresh for session: ${payload.sessionId}`);

    const session = await this.sessionRepository.findById(payload.sessionId);
    if (!session) {
      throw new UnauthorizedException('Invalid session');
    }
    if (session.logout_time) {
      throw new UnauthorizedException('Session has been logged out');
    }
    if (new Date() > session.expires_at) {
      throw new UnauthorizedException('Session has expired');
    }
    if (!payload.refreshToken) {
      throw new UnauthorizedException('Invalid refresh token payload');
    }
    const isRefreshTokenValid = await verifyHash(
      payload.refreshToken,
      session.refresh_token_hash,
    );
    if (!isRefreshTokenValid) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const newRefreshToken = Math.random().toString(36).substring(2);
    const newRefreshTokenHash = await hashValue(newRefreshToken);

    await this.sessionRepository.update(payload.sessionId, {
      refresh_token_hash: newRefreshTokenHash,
      last_activity: new Date(),
    });

    const newPayload: JwtPayload = {
      userId: payload.userId,
      sessionId: payload.sessionId,
      organizationId: payload.organizationId,
      enterpriseId: payload.enterpriseId,
      appId: payload.appId,
      isPlatformAdmin: payload.isPlatformAdmin,
    };

    const accessToken = this.tokenService.generateAccessToken(newPayload);
    const refreshTokenJwt = this.tokenService.generateRefreshToken({
      ...newPayload,
      refreshToken: newRefreshToken,
    });

    this.logger.log(`Token refreshed successfully: ${payload.sessionId}`);

    return {
      access_token: accessToken,
      refresh_token: refreshTokenJwt,
      expires_in: 900,
    };
  }

  // Update user password
  async updatePassword(
    loggedInUser: LoggedInUser,
    updatePasswordDto: UpdatePasswordDto,
  ): Promise<void> {
    const { userId } = loggedInUser;
    this.logger.log(`Password update for user: ${userId}`);

    // Get user
    const user = await this.userService.findOne(userId, loggedInUser);

    // Verify old password
    const isOldPasswordValid = await this.userService.verifyPassword(
      updatePasswordDto.old_password,
      user.password_hash,
    );
    if (!isOldPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    // Hash new password
    const newPasswordHash = await hashValue(updatePasswordDto.new_password);

    // Update user
    await this.userService.update(
      userId,
      {
        // @ts-ignore - password_hash is not in UpdateUserDto but we need to update it
        password_hash: newPasswordHash,
      },
      loggedInUser,
    );

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
    const otp = generateOtp();
    const otpHash = await hashValue(otp);

    // Store OTP
    await this.otpRepository.create({
      identifier: forgotPasswordDto.email,
      otp_hash: otpHash,
      user_id: user.id,
      purpose: OtpPurpose.RESET_PASSWORD,
      expires_at: calculateOtpExpiration(this.configService),
      attempts_count: 0,
    });

    // TODO: Send OTP via email
    // For now, log it (REMOVE IN PRODUCTION!)
    this.logger.warn(`OTP for ${forgotPasswordDto.email}: ${otp}`);

    this.logger.log(`OTP generated for password reset: ${user.id}`);
  }

  async verifyOtpAndResetPassword(
    verifyOtpDto: VerifyOtpAndResetPasswordDto,
  ): Promise<void> {
    this.logger.log(`OTP verification for email: ${verifyOtpDto.email}`);

    const otpRecord = await this.otpRepository.findByIdentifierAndPurpose(
      verifyOtpDto.email,
      OtpPurpose.RESET_PASSWORD,
    );

    if (!otpRecord) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    if (new Date() > otpRecord.expires_at) {
      await this.otpRepository.delete(otpRecord.id);
      throw new BadRequestException('OTP has expired');
    }

    const maxAttempts = this.configService.get<number>('otp.maxAttempts', 5);
    if (otpRecord.attempts_count >= maxAttempts) {
      await this.otpRepository.delete(otpRecord.id);
      throw new BadRequestException('Maximum OTP attempts exceeded');
    }

    const isDevBypass =
      this.configService.get<string>('brello.environment') === 'dev' &&
      verifyOtpDto.otp === '123456';
    const isOtpValid =
      isDevBypass || (await verifyHash(verifyOtpDto.otp, otpRecord.otp_hash));
    if (!isOtpValid) {
      await this.otpRepository.incrementAttempts(otpRecord.id);
      throw new BadRequestException('Invalid OTP');
    }

    const user = await this.userService.findByEmail(verifyOtpDto.email);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const newPasswordHash = await hashValue(verifyOtpDto.new_password);

    await this.userService.update(user.id, {
      // @ts-ignore
      password_hash: newPasswordHash,
    });

    await this.otpRepository.delete(otpRecord.id);

    await this.sessionRepository.deleteAllUserSessions(user.id);

    this.logger.log(`Password reset successfully: ${user.id}`);
  }

  // ---------- Resend OTP ----------

  async resendOtp(dto: ResendOtpDto): Promise<void> {
    this.logger.log(
      `OTP resend request for email: ${dto.email} (Purpose: ${dto.purpose})`,
    );

    // 1. Look up existing OTP record for this email + purpose
    const existingOtp = await this.otpRepository.findByIdentifierAndPurpose(
      dto.email,
      dto.purpose,
    );

    // 2. Resolve user_id — from existing OTP if present, otherwise look up from DB
    let userId: string;
    if (existingOtp) {
      userId = existingOtp.user_id;
    } else {
      const user = await this.userService.findByEmail(dto.email);
      if (!user) {
        throw new BadRequestException('No account found for this email.');
      }
      userId = user.id;
    }

    // 3. Clear old OTP (if any)
    await this.otpRepository.deleteByIdentifierAndPurpose(dto.email, dto.purpose);

    // 4. Generate new OTP
    const otp = generateOtp();
    const otpHash = await hashValue(otp);

    // 5. Save new OTP
    await this.otpRepository.create({
      identifier: dto.email,
      otp_hash: otpHash,
      user_id: userId,
      purpose: dto.purpose,
      expires_at: calculateOtpExpiration(this.configService),
      attempts_count: 0,
    });

    // 6. Build dynamic notification based on purpose
    const notification = this.getNotificationDetails(dto.purpose, dto.email, otp);

    this.notificationService.send({
      user_id: userId,
      target_email: dto.email,
      title: notification.title,
      message: notification.message,
      type: NotificationType.EMAIL,
    });

    this.logger.log(`Resent OTP to ${dto.email} for purpose ${dto.purpose}`);

    // Log for dev
    if (this.configService.get('brello.environment') === 'dev') {
      this.logger.warn(`[DEV] Resent OTP for ${dto.email}: ${otp}`);
    }
  }

  private getNotificationDetails(
    purpose: OtpPurpose,
    email: string,
    otp: string,
  ) {
    const expiration = this.configService.get<number>(
      'otp.expirationMinutes',
      10,
    );
    switch (purpose) {
      case OtpPurpose.LOGIN:
        return {
          title: 'Your Login OTP',
          message: `Your one-time password is: ${otp}. It will expire in ${expiration} minutes.`,
        };
      case OtpPurpose.RESET_PASSWORD:
        return {
          title: 'Reset Your Password',
          message: `Your password reset OTP is: ${otp}. It will expire in ${expiration} minutes.`,
        };
      case OtpPurpose.PLATFORM_ADMIN_REGISTER:
        return {
          title: 'Platform Admin Registration OTP',
          message: `Your registration OTP is ${otp}. Please use it to activate your admin account.`,
        };
      case OtpPurpose.PLATFORM_ADMIN_LOGIN:
        return {
          title: 'Platform Admin Login OTP',
          message: `Your login OTP is ${otp}. Please use it to access your admin account.`,
        };
      case OtpPurpose.LEAD_VERIFICATION:
        return {
          title: 'Verify Your Email',
          message: `Your verification OTP is ${otp}. It will expire in ${expiration} minutes.`,
        };
      default:
        return {
          title: 'Verification OTP',
          message: `Your verification OTP is ${otp}. It will expire in ${expiration} minutes.`,
        };
    }
  }
}
