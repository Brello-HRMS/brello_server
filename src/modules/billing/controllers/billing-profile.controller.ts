import {
  Controller,
  Get,
  Put,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { LoggedInUser } from '../../../common/decorators/logged-in-user.decorator';
import type { LoggedInUser as LoggedInUserInterface } from '../../auth/interfaces/logged-in-user.interface';
import { BillingProfileService } from '../services/billing-profile.service';
import { UpsertBillingProfileDto } from '../dto/billing-profile.dto';

@Controller('billing/profile')
@UseGuards(JwtAuthGuard)
export class BillingProfileController {
  constructor(private readonly service: BillingProfileService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  get(@LoggedInUser() user: LoggedInUserInterface) {
    return this.service.getOrCreate(user.organizationId);
  }

  @Put()
  @HttpCode(HttpStatus.OK)
  upsert(
    @LoggedInUser() user: LoggedInUserInterface,
    @Body() dto: UpsertBillingProfileDto,
  ) {
    return this.service.upsert(
      user.organizationId,
      user.enterpriseId ?? null,
      dto,
    );
  }
}
