import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Role } from './entities/role.entity';
import { UserRoleMap } from './entities/user-role-map.entity';
import { AppModule as AppEntity } from '../app-module/entities/app-module.entity';
import { Action } from '../app-module/entities/action.entity';
import { ModuleAccess } from '../app-module/entities/module-access.entity';
import { OrganizationSubscription } from '../plan/entities/organization-subscription.entity';
import { PlanModule as PlanModuleEntity } from '../plan/entities/plan-module.entity';
import { PlanModuleAction } from '../plan/entities/plan-module-action.entity';
import { PermissionResolverService } from './services/permission-resolver.service';
import { RoleService } from './services/role.service';
import { UserRoleMapService } from './services/user-role-map.service';
import { MenuController } from './controllers/menu.controller';
import { RoleController } from './controllers/role.controller';
import { UserRoleMapController } from './controllers/user-role-map.controller';
import { RoleRepository } from './repositories/role.repository';
import { UserRoleMapRepository } from './repositories/user-role-map.repository';

/**
 * RbacModule
 *
 * Encapsulates all RBAC functionality:
 * - Role / UserRoleMap / ModuleAccess entities
 * - PermissionResolverService (the core engine)
 * - MenuController (GET /menu)
 * - RoleController (CRUD /roles)
 * - UserRoleMapController (CRUD /user-role-maps)
 *
 * Exports PermissionResolverService so AccessGuard and other modules can use it.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Role,
      UserRoleMap,
      AppEntity,
      Action,
      ModuleAccess,
      OrganizationSubscription,
      PlanModuleEntity,
      PlanModuleAction,
    ]),
  ],
  controllers: [MenuController, RoleController, UserRoleMapController],
  providers: [
    PermissionResolverService,
    RoleService,
    UserRoleMapService,
    RoleRepository,
    UserRoleMapRepository,
  ],
  exports: [
    PermissionResolverService,
    RoleService,
    UserRoleMapService,
    RoleRepository,
    UserRoleMapRepository,
    TypeOrmModule,
  ],
})
export class RbacModule {}
