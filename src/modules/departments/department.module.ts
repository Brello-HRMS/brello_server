import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DepartmentService } from './services/department.service';
import { DepartmentController } from './controllers/department.controller';
import { Department } from './entities/department.entity';
import { DepartmentRepository } from './repositories/department.repository';
import { UserModule } from '../user/user.module';
import { GlobalSearchModule } from '../global-search/global-search.module';
import { RbacModule } from '../rbac/rbac.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Department]),
    UserModule,
    GlobalSearchModule,
    RbacModule,
  ],
  controllers: [DepartmentController],
  providers: [DepartmentService, DepartmentRepository],
  exports: [DepartmentService],
})
export class DepartmentModule {}
