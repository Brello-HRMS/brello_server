import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Enterprise } from './entities/enterprise.entity';
import { EnterpriseApp } from './entities/enterprise-app.entity';
import { EnterpriseController } from './controllers/enterprise.controller';
import { EnterpriseService } from './services/enterprise.service';
import { EnterpriseRepository } from './repositories/enterprise.repository';
import { EnterpriseAppRepository } from './repositories/enterprise-app.repository';
import { AppManagementModule } from '../app/app-management.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Enterprise, EnterpriseApp]),
    forwardRef(() => AppManagementModule),
  ],
  controllers: [EnterpriseController],
  providers: [EnterpriseService, EnterpriseRepository, EnterpriseAppRepository],
  exports: [
    EnterpriseService,
    EnterpriseRepository,
    EnterpriseAppRepository,
    TypeOrmModule,
  ],
})
export class EnterpriseModule {}
