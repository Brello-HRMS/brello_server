import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GlobalSearchModule } from '../global-search/global-search.module';
import { Role } from './entities/role.entity';
import { RoleApp } from './entities/role-app.entity';
import { RoleService } from './services/role.service';
import { RoleRepository } from './repositories/role.repository';
import { RoleAppRepository } from './repositories/role-app.repository';
import { PlatformRoleController } from './controllers/platform-role.controller';

// RoleController is registered in RbacModule (which has all RBAC dependencies).
// RoleModule only needs to export RoleService for other feature modules.
@Module({
  imports: [TypeOrmModule.forFeature([Role, RoleApp]), GlobalSearchModule],
  controllers: [PlatformRoleController],
  providers: [RoleService, RoleRepository, RoleAppRepository],
  exports: [RoleService, RoleRepository, RoleAppRepository],
})
export class RoleModule {}
