import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AccessGuard } from '../../../core/guards/access.guard';
import { RequirePermission } from '../../../core/guards/require-permission.decorator';
import { LoggedInUser } from '../../../common/decorators/logged-in-user.decorator';
import { AuditLog } from '../../audit/decorators/audit-log.decorator';
import { AuditLogModule } from '../../audit/enums/audit-log-module.enum';
import { AuditAction } from '../../audit/enums/audit-action.enum';
import { OfferLifecycleService } from '../services/offer-lifecycle.service';
import { OfferSyncService } from '../services/offer-sync.service';
import { OfferTimelineRepository } from '../repositories/offer-timeline.repository';
import {
  CreateOfferDto,
  UpdateOfferDto,
  SendOfferDto,
  WithdrawOfferDto,
  ExtendExpiryDto,
  FilterOffersDto,
} from '../dto/offer.dto';
import type { LoggedInUser as LoggedInUserInterface } from '../../auth/interfaces/logged-in-user.interface';

@Controller('offer-management/offers')
@UseGuards(JwtAuthGuard, AccessGuard)
export class OfferController {
  constructor(
    private readonly lifecycleService: OfferLifecycleService,
    private readonly timelineRepo: OfferTimelineRepository,
    private readonly syncService: OfferSyncService,
  ) {}

  @AuditLog(AuditLogModule.OFFER_MANAGEMENT, AuditAction.CREATE, 'offer')
  @Post()
  @RequirePermission('OFFER_CANDIDATES', 'create')
  @HttpCode(HttpStatus.CREATED)
  createDraft(
    @LoggedInUser() user: LoggedInUserInterface,
    @Body() dto: CreateOfferDto,
  ) {
    return this.lifecycleService.createDraft(user, dto);
  }

  @Get()
  @RequirePermission('OFFER_CANDIDATES', 'view')
  findAll(
    @LoggedInUser() user: LoggedInUserInterface,
    @Query() filters: FilterOffersDto,
  ) {
    return this.lifecycleService.findAll(user, filters);
  }

  @Get(':id')
  @RequirePermission('OFFER_CANDIDATES', 'view')
  findOne(
    @LoggedInUser() user: LoggedInUserInterface,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.lifecycleService.findOne(user, id);
  }

  @Get(':id/timeline')
  @RequirePermission('OFFER_CANDIDATES', 'view')
  getTimeline(@Param('id', ParseUUIDPipe) id: string) {
    return this.timelineRepo.findByOffer(id);
  }

  @Patch(':id')
  @RequirePermission('OFFER_CANDIDATES', 'edit')
  update(
    @LoggedInUser() user: LoggedInUserInterface,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOfferDto,
  ) {
    return this.lifecycleService.updateDraft(user, id, dto);
  }

  @AuditLog(AuditLogModule.OFFER_MANAGEMENT, AuditAction.GENERATE, 'offer')
  @Post(':id/send')
  @RequirePermission('OFFER_CANDIDATES', 'create')
  @HttpCode(HttpStatus.OK)
  send(
    @LoggedInUser() user: LoggedInUserInterface,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SendOfferDto,
  ) {
    return this.lifecycleService.sendOffer(user, id, dto);
  }

  @AuditLog(AuditLogModule.OFFER_MANAGEMENT, AuditAction.WITHDRAW, 'offer')
  @Post(':id/withdraw')
  @RequirePermission('OFFER_CANDIDATES', 'edit')
  @HttpCode(HttpStatus.OK)
  withdraw(
    @LoggedInUser() user: LoggedInUserInterface,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: WithdrawOfferDto,
  ) {
    return this.lifecycleService.withdrawOffer(user, id, dto);
  }

  @Post(':id/extend-expiry')
  @RequirePermission('OFFER_CANDIDATES', 'edit')
  @HttpCode(HttpStatus.OK)
  extendExpiry(
    @LoggedInUser() user: LoggedInUserInterface,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ExtendExpiryDto,
  ) {
    return this.lifecycleService.extendExpiry(user, id, dto);
  }

  @Post(':id/sync')
  @RequirePermission('OFFER_CANDIDATES', 'edit')
  @HttpCode(HttpStatus.OK)
  syncToEmployee(
    @LoggedInUser() user: LoggedInUserInterface,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.syncService.syncToEmployee(id, user.organizationId, user.userId);
  }
}
