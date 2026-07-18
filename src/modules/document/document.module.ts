import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';

import { Document } from './entities/document.entity';
import { DocumentRepository } from './repositories/document.repository';
import { StorageService } from './services/storage.service';
import { DocumentService } from './services/document.service';
import { DocumentController } from './controllers/document.controller';
import { DocumentViewController } from './controllers/document-view.controller';
import { EnterpriseModule } from '../enterprise/enterprise.module';
import { OrganizationModule } from '../organization/organization.module';
import { RbacModule } from '../rbac/rbac.module';
import { StorageStrategyFactory } from './strategies/storage-strategy.factory';
import { S3StorageStrategy } from './strategies/s3-storage.strategy';
import { DatabaseStorageStrategy } from './strategies/database-storage.strategy';
import { UserThrottlerGuard } from '../../common/guards/user-throttler.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([Document]),
    ConfigModule,
    EnterpriseModule,
    forwardRef(() => OrganizationModule),
    RbacModule,
  ],
  controllers: [DocumentController, DocumentViewController],
  providers: [
    DocumentRepository,
    StorageService,
    DocumentService,
    S3StorageStrategy,
    DatabaseStorageStrategy,
    StorageStrategyFactory,
    UserThrottlerGuard,
  ],
  exports: [DocumentService, StorageService, DocumentRepository],
})
export class DocumentModule {}
