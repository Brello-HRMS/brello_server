import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AccessGuard } from '../../../core/guards/access.guard';
import { RequirePermission } from '../../../core/guards/require-permission.decorator';
import { LoggedInUser } from '../../../common/decorators/logged-in-user.decorator';
import { RestrictedOnExpiry } from '../../billing/decorators/restricted-on-expiry.decorator';
import { OfferApprovalService } from '../services/offer-approval.service';
import { ApproveOfferStepDto, RejectOfferStepDto, AddApprovalStepDto } from '../dto/offer-approval.dto';
import type { LoggedInUser as LoggedInUserInterface } from '../../auth/interfaces/logged-in-user.interface';

@Controller('offer-management/offers/:offerId/approval')
@UseGuards(JwtAuthGuard, AccessGuard)
@RestrictedOnExpiry()
export class OfferApprovalController {
  constructor(private readonly approvalService: OfferApprovalService) {}

  @Get('steps')
  @RequirePermission('OFFER_CANDIDATES', 'view')
  getSteps(@Param('offerId', ParseUUIDPipe) offerId: string) {
    return this.approvalService.getSteps(offerId);
  }

  @Post('steps')
  @RequirePermission('OFFER_CANDIDATES', 'edit')
  addStep(
    @LoggedInUser() user: LoggedInUserInterface,
    @Param('offerId', ParseUUIDPipe) offerId: string,
    @Body() dto: AddApprovalStepDto,
  ) {
    return this.approvalService.addStep(user, offerId, dto);
  }

  @Post('submit')
  @RequirePermission('OFFER_CANDIDATES', 'edit')
  @HttpCode(HttpStatus.OK)
  submit(
    @LoggedInUser() user: LoggedInUserInterface,
    @Param('offerId', ParseUUIDPipe) offerId: string,
  ) {
    return this.approvalService.submitForApproval(user, offerId);
  }

  @Post('approve')
  @RequirePermission('OFFER_CANDIDATES', 'approve')
  @HttpCode(HttpStatus.OK)
  approve(
    @LoggedInUser() user: LoggedInUserInterface,
    @Param('offerId', ParseUUIDPipe) offerId: string,
    @Body() dto: ApproveOfferStepDto,
  ) {
    return this.approvalService.approve(user, offerId, dto);
  }

  @Post('reject')
  @RequirePermission('OFFER_CANDIDATES', 'approve')
  @HttpCode(HttpStatus.OK)
  reject(
    @LoggedInUser() user: LoggedInUserInterface,
    @Param('offerId', ParseUUIDPipe) offerId: string,
    @Body() dto: RejectOfferStepDto,
  ) {
    return this.approvalService.reject(user, offerId, dto);
  }
}
