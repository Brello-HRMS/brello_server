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

@Controller('billing/subscriptions')
@UseGuards(JwtAuthGuard)
export class SubscriptionController {
  constructor(private readonly subService: SubscriptionBillingService) {}

  @Post('change-plan')
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

  @Post('cancel-pending-change')
  @HttpCode(HttpStatus.OK)
  cancelPending(@LoggedInUser() user: LoggedInUserInterface) {
    return this.subService.cancelPendingChange(user.organizationId);
  }

  @Post('cancel')
  @HttpCode(HttpStatus.OK)
  cancel(@LoggedInUser() user: LoggedInUserInterface) {
    return this.subService.cancelSubscription(user.organizationId);
  }
}
