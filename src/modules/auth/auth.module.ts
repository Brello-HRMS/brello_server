import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthService } from './services/auth.service';
import { AuthController } from './controllers/auth.controller';
import { Session } from './entities/session.entity';
import { Otp } from './entities/otp.entity';
import { SessionRepository } from './repositories/session.repository';
import { OtpRepository } from './repositories/otp.repository';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';
import { OtpCleanupTask } from './tasks/otp-cleanup.task';
import { UserModule } from '../user/user.module';

/**
 * Auth Module
 * 
 * Encapsulates all authentication and authorization functionality.
 * Follows the Module pattern for organizing related components.
 * 
 * Design Pattern: Module Pattern
 * - Groups related components together
 * - Provides clear boundaries and dependencies
 * - Configures JWT and Passport
 * 
 * Features:
 * - JWT-based authentication
 * - Refresh token rotation
 * - Session management
 * - OTP for password reset
 * - Scheduled cleanup tasks
 */
@Module({
    imports: [
        TypeOrmModule.forFeature([Session, Otp]),
        UserModule, // Import to access UserService
        PassportModule,
        JwtModule.register({}), // Empty config, we'll use ConfigService in strategies
        ConfigModule,
        ScheduleModule.forRoot(), // Enable scheduling
    ],
    controllers: [AuthController],
    providers: [
        AuthService,
        SessionRepository,
        OtpRepository,
        JwtStrategy,
        JwtRefreshStrategy,
        OtpCleanupTask,
    ],
    exports: [AuthService], // Export for potential use in other modules
})
export class AuthModule { }
