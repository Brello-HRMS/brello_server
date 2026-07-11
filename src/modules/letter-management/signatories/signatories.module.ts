import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Signatory } from './entities/signatory.entity';
import { SignatoryRepository } from './repositories/signatory.repository';
import { SignatoryService } from './services/signatory.service';
import { SignatoryController } from './controllers/signatory.controller';
import { DocumentModule } from '../../document/document.module';
import { RbacModule } from '../../rbac/rbac.module';

@Module({
  imports: [TypeOrmModule.forFeature([Signatory]), DocumentModule, RbacModule],
  controllers: [SignatoryController],
  providers: [SignatoryRepository, SignatoryService],
  exports: [SignatoryService, SignatoryRepository],
})
export class SignatoriesModule {}
