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
import { AuditLog } from '../../audit/decorators/audit-log.decorator';
import { AuditLogModule } from '../../audit/enums/audit-log-module.enum';
import { AuditAction } from '../../audit/enums/audit-action.enum';
import { OfferMessageService } from '../services/offer-message.service';
import type { LoggedInUser as LoggedInUserInterface } from '../../auth/interfaces/logged-in-user.interface';

@Controller('offer-management/offers/:offerId/messages')
@UseGuards(JwtAuthGuard, AccessGuard)
@RestrictedOnExpiry()
export class OfferMessageController {
  constructor(private readonly messageService: OfferMessageService) {}

  @Get()
  @RequirePermission('OFFER_CANDIDATES', 'view')
  getMessages(@Param('offerId', ParseUUIDPipe) offerId: string) {
    return this.messageService.getMessages(offerId, 'hr');
  }

  @AuditLog(AuditLogModule.OFFER_MANAGEMENT, AuditAction.CREATE, 'offer_message')
  @Post()
  @RequirePermission('OFFER_CANDIDATES', 'edit')
  @HttpCode(HttpStatus.CREATED)
  sendMessage(
    @LoggedInUser() user: LoggedInUserInterface,
    @Param('offerId', ParseUUIDPipe) offerId: string,
    @Body() dto: { message: string; attachments?: string[] },
  ) {
    return this.messageService.sendHrMessage(user, offerId, dto.message, dto.attachments);
  }
}
