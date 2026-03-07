import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Entities
import { AppModule as AppModuleEntity } from './entities/app-module.entity';
import { Action } from './entities/action.entity';
import { ModuleAccess } from './entities/module-access.entity';

// Repositories
import { AppModuleRepository } from './repositories/app-module.repository';
import { ActionRepository } from './repositories/action.repository';
import { ModuleAccessRepository } from './repositories/module-access.repository';

// Services
import { AppModuleService } from './services/app-module.service';
import { ActionService } from './services/action.service';
import { ModuleAccessService } from './services/module-access.service';

// Controllers
import { AppModuleController } from './controllers/app-module.controller';
import { ActionController } from './controllers/action.controller';
import { ModuleAccessController } from './controllers/module-access.controller';

@Module({
  imports: [TypeOrmModule.forFeature([AppModuleEntity, Action, ModuleAccess])],
  controllers: [AppModuleController, ActionController, ModuleAccessController],
  providers: [
    AppModuleRepository,
    ActionRepository,
    ModuleAccessRepository,
    AppModuleService,
    ActionService,
    ModuleAccessService,
  ],
  exports: [
    AppModuleRepository,
    ActionRepository,
    ModuleAccessRepository,
    AppModuleService,
    ActionService,
    ModuleAccessService,
    TypeOrmModule,
  ],
})
export class AppModuleModule {}
