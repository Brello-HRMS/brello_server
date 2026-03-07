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
import { OtpRepository } from './repositories/otp.repository';
import { PlatformAdminAuthController } from './controllers/platform-admin-auth.controller';
import { PlatformAdminAuthService } from './services/platform-admin-auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';
import { OtpCleanupTask } from './tasks/otp-cleanup.task';
import { UserModule } from '../user/user.module';
import { UserRoleMap } from '../rbac/entities/user-role-map.entity';
import { Role } from '../role/entities/role.entity';
import { App } from '../app/entities/app.entity';
import { SessionRepository } from './repositories/session.repository';
import { NotificationModule } from '../notification/notification.module';

/**
 * Auth Module
 *
 * Encapsulates all authentication functionality.
 * Now extended with multi-app support:
 * - Login resolves available apps & default app from user roles
 * - JWT payload includes appId, organizationId, enterpriseId
 * - switch-app endpoint issues app-scoped tokens
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Session,
      Otp,
      UserRoleMap, // For login: resolving available apps from user roles
      Role, // Joined via UserRoleMap
      App, // For fetching app priority/name
    ]),
    UserModule,
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '1d' },
    }),
    ConfigModule,
    ScheduleModule.forRoot(),
    NotificationModule,
  ],
  controllers: [AuthController, PlatformAdminAuthController],
  providers: [
    AuthService,
    PlatformAdminAuthService,
    SessionRepository,
    OtpRepository,
    JwtStrategy,
    JwtRefreshStrategy,
    OtpCleanupTask,
  ],
  exports: [AuthService, PlatformAdminAuthService],
})
export class AuthModule {}
