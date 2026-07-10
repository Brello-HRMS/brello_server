import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { App } from './entities/app.entity';
import { AppService } from './services/app.service';
import { AppController } from './controllers/app.controller';
import { EnterpriseModule } from '../enterprise/enterprise.module';

import { AppRepository } from './repositories/app.repository';
import { RbacModule } from '../rbac/rbac.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([App]),
    forwardRef(() => EnterpriseModule),
    RbacModule,
  ],
  controllers: [AppController],
  providers: [AppService, AppRepository],
  exports: [AppService, AppRepository, TypeOrmModule],
})
export class AppManagementModule {}
