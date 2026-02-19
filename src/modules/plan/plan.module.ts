import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Plan } from './entities/plan.entity';
import { OrganizationSubscription } from './entities/organization-subscription.entity';
import { PlanModule as PlanModuleEntity } from './entities/plan-module.entity';
import { PlanModuleAction } from './entities/plan-module-action.entity';

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
        ]),
    ],
    exports: [TypeOrmModule],
})
export class PlanModule { }
