import { AccessGuard } from '../../../core/guards/access.guard';
import { RequirePermission } from '../../../core/guards/require-permission.decorator';
import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { LoggedInUser } from '../../../common/decorators/logged-in-user.decorator';
import type { LoggedInUser as LoggedInUserInterface } from '../../auth/interfaces/logged-in-user.interface';
import { BillingOverviewService } from '../services/billing-overview.service';
import { PlanComparisonService } from '../services/plan-comparison.service';
import { ListPlansDto } from '../dto/list-plans.dto';
import { BillingCycle } from '../../plan/entities/plan.entity';

@Controller('billing')
@UseGuards(JwtAuthGuard, AccessGuard)
export class BillingOverviewController {
  constructor(
    private readonly overviewService: BillingOverviewService,
    private readonly planComparison: PlanComparisonService,
  ) {}

  @Get('overview')
  @RequirePermission('BILLING', 'view')
  @HttpCode(HttpStatus.OK)
  getOverview(@LoggedInUser() user: LoggedInUserInterface) {
    return this.overviewService.build(user.organizationId);
  }

  @Get('plans')
  @RequirePermission('BILLING', 'view')
  @HttpCode(HttpStatus.OK)
  listPlans(
    @LoggedInUser() user: LoggedInUserInterface,
    @Query() query: ListPlansDto,
  ) {
    return this.planComparison.compare({
      organizationId: user.organizationId,
      cycle: query.cycle ?? BillingCycle.MONTHLY,
    });
  }
}
