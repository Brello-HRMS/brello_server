import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GlobalSearchModule } from '../global-search/global-search.module';
import { Role } from './entities/role.entity';
import { RoleService } from './services/role.service';
import { RoleRepository } from './repositories/role.repository';
import { PlatformRoleController } from './controllers/platform-role.controller';

// RoleController is registered in RbacModule (which has all RBAC dependencies).
// RoleModule only needs to export RoleService for other feature modules.
@Module({
  imports: [TypeOrmModule.forFeature([Role]), GlobalSearchModule],
  controllers: [PlatformRoleController],
  providers: [RoleService, RoleRepository],
  exports: [RoleService, RoleRepository],
})
export class RoleModule {}
