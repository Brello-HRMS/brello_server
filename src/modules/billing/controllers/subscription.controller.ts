import { AccessGuard } from '../../../core/guards/access.guard';
import { RequirePermission } from '../../../core/guards/require-permission.decorator';
import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { LoggedInUser } from '../../../common/decorators/logged-in-user.decorator';
import type { LoggedInUser as LoggedInUserInterface } from '../../auth/interfaces/logged-in-user.interface';
import { SubscriptionBillingService } from '../services/subscription-billing.service';
import { ChangePlanDto } from '../dto/change-plan.dto';
import { AuditLog } from '../../audit/decorators/audit-log.decorator';
import { AuditLogModule } from '../../audit/enums/audit-log-module.enum';
import { AuditAction } from '../../audit/enums/audit-action.enum';

@Controller('billing/subscriptions')
@UseGuards(JwtAuthGuard, AccessGuard)
export class SubscriptionController {
  constructor(private readonly subService: SubscriptionBillingService) {}

  @AuditLog(AuditLogModule.SUBSCRIPTION, AuditAction.UPDATE, 'subscription')
  @Post('change-plan')
  @RequirePermission('BILLING', 'create')
  @HttpCode(HttpStatus.OK)
  changePlan(
    @LoggedInUser() user: LoggedInUserInterface,
    @Body() dto: ChangePlanDto,
  ) {
    return this.subService.changePlan({
      organizationId: user.organizationId,
      enterpriseId: user.enterpriseId ?? null,
      newPlanId: dto.plan_id,
      newCycle: dto.billing_cycle,
    });
  }

  @AuditLog(AuditLogModule.SUBSCRIPTION, AuditAction.CANCEL, 'subscription')
  @Post('cancel-pending-change')
  @RequirePermission('BILLING', 'create')
  @HttpCode(HttpStatus.OK)
  cancelPending(@LoggedInUser() user: LoggedInUserInterface) {
    return this.subService.cancelPendingChange(user.organizationId);
  }

  @AuditLog(AuditLogModule.SUBSCRIPTION, AuditAction.CANCEL, 'subscription')
  @Post('cancel')
  @RequirePermission('BILLING', 'create')
  @HttpCode(HttpStatus.OK)
  cancel(@LoggedInUser() user: LoggedInUserInterface) {
    return this.subService.cancelSubscription(user.organizationId);
  }
}
