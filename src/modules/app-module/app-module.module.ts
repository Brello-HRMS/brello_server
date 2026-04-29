import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Entities
import { AppModule as AppModuleEntity } from './entities/app-module.entity';
import { Action } from './entities/action.entity';
import { ModuleAccess } from './entities/module-access.entity';
import { UserRoleMap } from '../rbac/entities/user-role-map.entity';

// Repositories
import { AppModuleRepository } from './repositories/app-module.repository';
import { ActionRepository } from './repositories/action.repository';
import { ModuleAccessRepository } from './repositories/module-access.repository';
import { UserRoleMapRepository } from '../rbac/repositories/user-role-map.repository';

// Services
import { AppModuleService } from './services/app-module.service';
import { ActionService } from './services/action.service';
import { ModuleAccessService } from './services/module-access.service';

// Controllers
import { AppModuleController } from './controllers/app-module.controller';
import { ActionController } from './controllers/action.controller';
import { ModuleAccessController } from './controllers/module-access.controller';

import { PlanModule } from '../plan/plan.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([AppModuleEntity, Action, ModuleAccess, UserRoleMap]),
    PlanModule,
  ],
  controllers: [AppModuleController, ActionController, ModuleAccessController],
  providers: [
    AppModuleRepository,
    ActionRepository,
    ModuleAccessRepository,
    UserRoleMapRepository,
    AppModuleService,
    ActionService,
    ModuleAccessService,
  ],
  exports: [
    AppModuleRepository,
    ActionRepository,
    ModuleAccessRepository,
    UserRoleMapRepository,
    AppModuleService,
    ActionService,
    ModuleAccessService,
    TypeOrmModule,
  ],
})
export class AppModuleModule {}
