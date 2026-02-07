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
import { LoginDto } from '../dto/login.dto';
import { UpdatePasswordDto } from '../dto/update-password.dto';
import {
    ForgotPasswordRequestDto,
    VerifyOtpAndResetPasswordDto,
} from '../dto/forgot-password.dto';
import { AuthResponseDto, RefreshTokenResponseDto } from '../dto/auth-response.dto';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { OtpPurpose } from '../../../common/enums';

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
    ) { }

    // Generate access token
    private generateAccessToken(payload: JwtPayload): string {
        const plainPayload = { ...payload };
        return this.jwtService.sign(plainPayload, {
            secret: this.configService.get<string>('JWT_ACCESS_SECRET') || 'default-secret',
            expiresIn: '15m',
        });
    }

    // Generate refresh token
    private generateRefreshToken(payload: JwtPayload): string {
        const plainPayload = { ...payload };
        return this.jwtService.sign(plainPayload, {
            secret: this.configService.get<string>('JWT_REFRESH_SECRET') || 'default-refresh-secret',
            expiresIn: '7d',
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
        const days = parseInt(
            this.configService.get<string>('SESSION_EXPIRATION_DAYS') || '7',
        );
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + days);
        return expiresAt;
    }

    // Calculate OTP expiration date
    private calculateOtpExpiration(): Date {
        const minutes = parseInt(
            this.configService.get<string>('OTP_EXPIRATION_MINUTES') || '10',
        );
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + minutes);
        return expiresAt;
    }

    // Login user
    async login(loginDto: LoginDto): Promise<AuthResponseDto> {
        this.logger.log(`Login attempt for email: ${loginDto.email}`);

        // Find user by email
        const user = await this.userService.findByEmail(loginDto.email);
        if (!user) {
            throw new UnauthorizedException('Invalid email or password');
        }

        // Verify password
        const isPasswordValid = await this.userService.verifyPassword(
            loginDto.password,
            user.password_hash,
        );
        if (!isPasswordValid) {
            throw new UnauthorizedException('Invalid email or password');
        }

        // Generate refresh token
        const refreshToken = Math.random().toString(36).substring(2);
        const refreshTokenHash = await this.hash(refreshToken);

        // Create session
        const session = await this.sessionRepository.create({
            user_id: user.id,
            refresh_token_hash: refreshTokenHash,
            device_fingerprint: loginDto.device_fingerprint || 'unknown',
            login_time: new Date(),
            last_activity: new Date(),
            expires_at: this.calculateSessionExpiration(),
        });

        // Generate JWT tokens
        const payload: JwtPayload = {
            userId: user.id,
            sessionId: session.id,
        };

        const accessToken = this.generateAccessToken(payload);
        const refreshTokenJwt = this.generateRefreshToken({
            ...payload,
            refreshToken,
        });

        this.logger.log(`User logged in successfully: ${user.id}`);

        return {
            access_token: accessToken,
            refresh_token: refreshTokenJwt,
            user: {
                id: user.id,
                email: user.email,
                first_name: user.first_name,
                last_name: user.last_name,
                enterprise_id: user.enterprise_id,
                organization_id: user.organization_id,
            },
            expires_in: 900, // 15 minutes in seconds
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
            this.logger.warn(`Forgot password attempt for non-existent email: ${forgotPasswordDto.email}`);
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
        const maxAttempts = parseInt(
            this.configService.get<string>('OTP_MAX_ATTEMPTS') ?? '5',
            10,
        );
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
