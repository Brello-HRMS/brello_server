import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AccessGuard } from '../../../core/guards/access.guard';
import { RequirePermission } from '../../../core/guards/require-permission.decorator';
import { LoggedInUser } from '../../../common/decorators/logged-in-user.decorator';
import { OfferAnalyticsService } from '../services/offer-analytics.service';
import type { LoggedInUser as LoggedInUserInterface } from '../../auth/interfaces/logged-in-user.interface';

@Controller('offer-management/analytics')
@UseGuards(JwtAuthGuard, AccessGuard)
export class OfferAnalyticsController {
  constructor(private readonly analyticsService: OfferAnalyticsService) {}

  @Get()
  @RequirePermission('OFFER_ANALYTICS', 'view')
  get(@LoggedInUser() user: LoggedInUserInterface) {
    return this.analyticsService.getAnalytics(user);
  }
}
