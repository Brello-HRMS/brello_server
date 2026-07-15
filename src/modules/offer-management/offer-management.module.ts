import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Entities
import { OfferTemplate } from './entities/offer-template.entity';
import { OfferCandidate } from './entities/offer-candidate.entity';
import { Offer } from './entities/offer.entity';
import { OfferVersion } from './entities/offer-version.entity';
import { OfferTimeline } from './entities/offer-timeline.entity';
import { OfferApprovalStep } from './entities/offer-approval-step.entity';
import { OfferDocument } from './entities/offer-document.entity';
import { OfferMessage } from './entities/offer-message.entity';
import { OfferSettings } from './entities/offer-settings.entity';

// Repositories
import { OfferTemplateRepository } from './repositories/offer-template.repository';
import { OfferCandidateRepository } from './repositories/offer-candidate.repository';
import { OfferRepository } from './repositories/offer.repository';
import { OfferVersionRepository } from './repositories/offer-version.repository';
import { OfferTimelineRepository } from './repositories/offer-timeline.repository';
import { OfferSettingsRepository } from './repositories/offer-settings.repository';
import { OfferDocumentRepository } from './repositories/offer-document.repository';
import { OfferMessageRepository } from './repositories/offer-message.repository';

// Services
import { OfferTemplateService } from './services/offer-template.service';
import { OfferCandidateService } from './services/offer-candidate.service';
import { OfferLifecycleService } from './services/offer-lifecycle.service';
import { OfferPortalService } from './services/offer-portal.service';
import { OfferApprovalService } from './services/offer-approval.service';
import { OfferNotificationService } from './services/offer-notification.service';
import { OfferAnalyticsService } from './services/offer-analytics.service';
import { OfferSettingsService } from './services/offer-settings.service';
import { OfferSchedulerService } from './services/offer-scheduler.service';
import { OfferNumberService } from './services/offer-number.service';
import { OfferSyncService } from './services/offer-sync.service';
import { OfferPdfService } from './services/offer-pdf.service';
import { OfferDocumentService } from './services/offer-document.service';
import { OfferMessageService } from './services/offer-message.service';

// Controllers
import { OfferTemplateController } from './controllers/offer-template.controller';
import { OfferCandidateController } from './controllers/offer-candidate.controller';
import { OfferController } from './controllers/offer.controller';
import { OfferPortalController } from './controllers/offer-portal.controller';
import { OfferApprovalController } from './controllers/offer-approval.controller';
import { OfferAnalyticsController } from './controllers/offer-analytics.controller';
import { OfferSettingsController } from './controllers/offer-settings.controller';
import { OfferDocumentController } from './controllers/offer-document.controller';
import { OfferMessageController } from './controllers/offer-message.controller';

// External
import { NotificationModule } from '../notification/notification.module';
import { RbacModule } from '../rbac/rbac.module';
import { UserModule } from '../user/user.module';
import { PayrollModule } from '../payroll/payroll.module';
import { DocumentModule } from '../document/document.module';
import { LetterSharedModule } from '../letter-management/shared/letter-shared.module';
import { SignatoriesModule } from '../letter-management/signatories/signatories.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      OfferTemplate,
      OfferCandidate,
      Offer,
      OfferVersion,
      OfferTimeline,
      OfferApprovalStep,
      OfferDocument,
      OfferMessage,
      OfferSettings,
    ]),
    NotificationModule,
    RbacModule,
    UserModule,
    PayrollModule,
    DocumentModule,
    LetterSharedModule,
    SignatoriesModule,
  ],
  controllers: [
    OfferTemplateController,
    OfferCandidateController,
    OfferController,
    OfferPortalController,
    OfferApprovalController,
    OfferAnalyticsController,
    OfferSettingsController,
    OfferDocumentController,
    OfferMessageController,
  ],
  providers: [
    // Repositories
    OfferTemplateRepository,
    OfferCandidateRepository,
    OfferRepository,
    OfferVersionRepository,
    OfferTimelineRepository,
    OfferSettingsRepository,
    OfferDocumentRepository,
    OfferMessageRepository,
    // Services
    OfferTemplateService,
    OfferCandidateService,
    OfferLifecycleService,
    OfferPortalService,
    OfferApprovalService,
    OfferNotificationService,
    OfferAnalyticsService,
    OfferSettingsService,
    OfferSchedulerService,
    OfferNumberService,
    OfferSyncService,
    OfferPdfService,
    OfferDocumentService,
    OfferMessageService,
  ],
  exports: [OfferLifecycleService, OfferCandidateService, OfferSyncService],
})
export class OfferManagementModule {}
