import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
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
import { OfferDocumentService } from '../services/offer-document.service';
import type { LoggedInUser as LoggedInUserInterface } from '../../auth/interfaces/logged-in-user.interface';

@Controller('offer-management/offers/:offerId/documents')
@UseGuards(JwtAuthGuard, AccessGuard)
@RestrictedOnExpiry()
export class OfferDocumentController {
  constructor(private readonly documentService: OfferDocumentService) {}

  @Get()
  @RequirePermission('OFFER_CANDIDATES', 'view')
  getDocuments(@Param('offerId', ParseUUIDPipe) offerId: string) {
    return this.documentService.getDocumentsForOffer(offerId);
  }

  @AuditLog(AuditLogModule.OFFER_MANAGEMENT, AuditAction.CREATE, 'offer_document')
  @Post()
  @RequirePermission('OFFER_CANDIDATES', 'edit')
  @HttpCode(HttpStatus.CREATED)
  addDocument(
    @Param('offerId', ParseUUIDPipe) offerId: string,
    @Body() dto: { document_type: string; file_url: string; original_filename?: string },
  ) {
    // HR is uploading
    return this.documentService.addDocument(offerId, { ...dto, uploaded_by_candidate: false });
  }

  @AuditLog(AuditLogModule.OFFER_MANAGEMENT, AuditAction.UPDATE, 'offer_document')
  @Patch(':documentId/verify')
  @RequirePermission('OFFER_CANDIDATES', 'edit')
  verifyDocument(
    @LoggedInUser() user: LoggedInUserInterface,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Body() dto: { status: 'verified' | 'rejected'; reason?: string },
  ) {
    return this.documentService.updateVerificationStatus(user, documentId, dto);
  }

  @AuditLog(AuditLogModule.OFFER_MANAGEMENT, AuditAction.DELETE, 'offer_document')
  @Delete(':documentId')
  @RequirePermission('OFFER_CANDIDATES', 'edit')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteDocument(
    @LoggedInUser() user: LoggedInUserInterface,
    @Param('documentId', ParseUUIDPipe) documentId: string,
  ) {
    return this.documentService.deleteDocument(user, documentId);
  }
}
