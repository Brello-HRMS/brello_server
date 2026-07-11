import { Controller, Get, Patch, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AccessGuard } from '../../../core/guards/access.guard';
import { RequirePermission } from '../../../core/guards/require-permission.decorator';
import { LoggedInUser } from '../../../common/decorators/logged-in-user.decorator';
import { OfferSettingsService } from '../services/offer-settings.service';
import { UpdateOfferSettingsDto } from '../dto/offer-settings.dto';
import type { LoggedInUser as LoggedInUserInterface } from '../../auth/interfaces/logged-in-user.interface';

@Controller('offer-management/settings')
@UseGuards(JwtAuthGuard, AccessGuard)
export class OfferSettingsController {
  constructor(private readonly settingsService: OfferSettingsService) {}

  @Get()
  @RequirePermission('OFFER_SETTINGS', 'view')
  get(@LoggedInUser() user: LoggedInUserInterface) {
    return this.settingsService.getOrCreate(user);
  }

  @Patch()
  @RequirePermission('OFFER_SETTINGS', 'edit')
  @HttpCode(HttpStatus.OK)
  update(
    @LoggedInUser() user: LoggedInUserInterface,
    @Body() dto: UpdateOfferSettingsDto,
  ) {
    return this.settingsService.update(user, dto);
  }
}
