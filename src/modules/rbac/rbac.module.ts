import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Role } from './entities/role.entity';
import { UserRoleMap } from './entities/user-role-map.entity';
import { AppModule as AppEntity } from './entities/module.entity';
import { Action } from './entities/action.entity';
import { ModuleAccess } from './entities/module-access.entity';
import { OrganizationSubscription } from '../plan/entities/organization-subscription.entity';
import { PlanModule as PlanModuleEntity } from '../plan/entities/plan-module.entity';
import { PlanModuleAction } from '../plan/entities/plan-module-action.entity';
import { PermissionResolverService } from './services/permission-resolver.service';
import { MenuController } from './controllers/menu.controller';

/**
 * RbacModule
 *
 * Encapsulates all RBAC functionality:
 * - Role / UserRoleMap / ModuleAccess entities
 * - PermissionResolverService (the core engine)
 * - MenuController (GET /menu)
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
    controllers: [MenuController],
    providers: [PermissionResolverService],
    exports: [PermissionResolverService, TypeOrmModule],
})
export class RbacModule { }
