import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EnterpriseModule } from '../enterprise/enterprise.module';
import { OrganizationModule } from '../organization/organization.module';
import { Plan } from './entities/plan.entity';
import { OrganizationSubscription } from './entities/organization-subscription.entity';
import { PlanModule as PlanModuleEntity } from './entities/plan-module.entity';
import { PlanModuleAction } from './entities/plan-module-action.entity';
import { PlanApp } from './entities/plan-app.entity';

// Repositories
import { PlanRepository } from './repositories/plan.repository';
import { OrganizationSubscriptionRepository } from './repositories/organization-subscription.repository';
import { PlanModuleRepository } from './repositories/plan-module.repository';
import { PlanModuleActionRepository } from './repositories/plan-module-action.repository';
import { PlanAppRepository } from './repositories/plan-app.repository';

// Services
import { PlanService } from './services/plan.service';
import { OrganizationSubscriptionService } from './services/organization-subscription.service';
import { PlanModuleService } from './services/plan-module.service';
import { PlanModuleActionService } from './services/plan-module-action.service';

// Controllers
import { PlanController } from './controllers/plan.controller';
import { OrganizationSubscriptionController } from './controllers/organization-subscription.controller';
import { PlanModuleController } from './controllers/plan-module.controller';
import { PlanModuleActionController } from './controllers/plan-module-action.controller';

/**
 * PlanModule
 *
 * Manages subscription plans and organization subscriptions.
 * Entities are also used directly by RbacModule's PermissionResolver.
 *
 * Exports TypeOrmModule so plan entities are available to other modules.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Plan,
      OrganizationSubscription,
      PlanModuleEntity,
      PlanModuleAction,
      PlanApp,
    ]),
    EnterpriseModule,
    OrganizationModule,
  ],
  controllers: [
    PlanController,
    OrganizationSubscriptionController,
    PlanModuleController,
    PlanModuleActionController,
  ],
  providers: [
    PlanRepository,
    OrganizationSubscriptionRepository,
    PlanModuleRepository,
    PlanModuleActionRepository,
    PlanService,
    OrganizationSubscriptionService,
    PlanModuleService,
    PlanModuleActionService,
    PlanAppRepository,
  ],
  exports: [
    PlanRepository,
    OrganizationSubscriptionRepository,
    PlanModuleRepository,
    PlanModuleActionRepository,
    PlanService,
    OrganizationSubscriptionService,
    PlanModuleService,
    PlanModuleActionService,
    PlanAppRepository,
    TypeOrmModule,
  ],
})
export class PlanModule {}
