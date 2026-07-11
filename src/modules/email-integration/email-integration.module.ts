import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';

import { EmailIntegration } from './entities/email-integration.entity';
import { EmailIntegrationRepository } from './repositories/email-integration.repository';
import { EmailIntegrationService } from './services/email-integration.service';
import { GoogleOAuthService } from './services/google-oauth.service';
import { GmailSenderService } from './services/gmail-sender.service';
import { EmailIntegrationController } from './controllers/email-integration.controller';
import { EncryptionService } from '../../common/services/encryption.service';
import { RbacModule } from '../rbac/rbac.module';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([EmailIntegration]),
    RbacModule, // provides PermissionResolverService for AccessGuard
    // Signs/verifies the short-lived OAuth `state` token.
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('auth.JWT_SECRET'),
      }),
    }),
  ],
  controllers: [EmailIntegrationController],
  providers: [
    EmailIntegrationService,
    GoogleOAuthService,
    GmailSenderService,
    EmailIntegrationRepository,
    EncryptionService,
  ],
  // GmailSenderService is consumed by the notification pipeline for per-org sends.
  exports: [GmailSenderService],
})
export class EmailIntegrationModule {}
