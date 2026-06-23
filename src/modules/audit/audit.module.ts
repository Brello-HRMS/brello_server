import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { SystemAuditLog } from './entities/system-audit-log.entity';
import { User } from '../user/entities/user.entity';
import { AuditLogRepository } from './repositories/audit-log.repository';
import { AuditActorResolver } from './services/audit-actor-resolver.service';
import { AuditContextService } from './services/audit-context.service';
import { AuditService } from './services/audit.service';
import { AuditInterceptor } from './interceptors/audit.interceptor';
import { AuditController } from './controllers/audit.controller';
import { PlatformAuditController } from './controllers/platform-audit.controller';
import { RbacModule } from '../rbac/rbac.module';
import { AUDIT_SERVICE_TOKEN } from './interfaces/audit-service.interface';

/**
 * Self-contained audit module — no circular dependencies.
 *
 * Microservice extraction: swap the AUDIT_SERVICE_TOKEN provider:
 *   { provide: AUDIT_SERVICE_TOKEN, useClass: AuditServiceProxy }
 * where AuditServiceProxy implements IAuditService and publishes to a queue.
 * Zero changes needed in callers (AuthModule, UserModule, etc.).
 */
@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([SystemAuditLog, User]),
    RbacModule,
  ],
  controllers: [AuditController, PlatformAuditController],
  providers: [
    AuditLogRepository,
    AuditActorResolver,
    AuditContextService,
    AuditService,
    AuditInterceptor,
    {
      provide: AUDIT_SERVICE_TOKEN,
      useClass: AuditService,
    },
    {
      provide: APP_INTERCEPTOR,
      useExisting: AuditInterceptor,
    },
  ],
  exports: [
    AUDIT_SERVICE_TOKEN,
    AuditContextService,
    AuditInterceptor,
  ],
})
export class AuditCoreModule {}
