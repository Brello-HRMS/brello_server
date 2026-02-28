import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';

import { Document } from './entities/document.entity';
import { DocumentRepository } from './repositories/document.repository';
import { StorageService } from './services/storage.service';
import { DocumentService } from './services/document.service';
import { DocumentController } from './controllers/document.controller';
import { EnterpriseModule } from '../enterprise/enterprise.module';
import { OrganizationModule } from '../organization/organization.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Document]),
    ConfigModule,
    EnterpriseModule,
    OrganizationModule,
  ],
  controllers: [DocumentController],
  providers: [DocumentRepository, StorageService, DocumentService],
  exports: [DocumentService, StorageService],
})
export class DocumentModule {}
