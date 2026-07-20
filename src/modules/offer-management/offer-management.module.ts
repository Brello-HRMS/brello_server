import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Entities
import { OfferTemplate } from './entities/offer-template.entity';
import { OfferCandidate } from './entities/offer-candidate.entity';
import { Offer } from './entities/offer.entity';
import { OfferVersion } from './entities/offer-version.entity';
import { OfferTimeline } from './entities/offer-timeline.entity';
import { OfferApprovalStep } from './entities/offer-approval-step.entity';
import { OfferSettings } from './entities/offer-settings.entity';

// Repositories
import { OfferTemplateRepository } from './repositories/offer-template.repository';
import { OfferCandidateRepository } from './repositories/offer-candidate.repository';
import { OfferRepository } from './repositories/offer.repository';
import { OfferVersionRepository } from './repositories/offer-version.repository';
import { OfferTimelineRepository } from './repositories/offer-timeline.repository';
import { OfferSettingsRepository } from './repositories/offer-settings.repository';

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

// Controllers
import { OfferTemplateController } from './controllers/offer-template.controller';
import { OfferCandidateController } from './controllers/offer-candidate.controller';
import { OfferController } from './controllers/offer.controller';
import { OfferPortalController } from './controllers/offer-portal.controller';
import { OfferApprovalController } from './controllers/offer-approval.controller';
import { OfferAnalyticsController } from './controllers/offer-analytics.controller';
import { OfferSettingsController } from './controllers/offer-settings.controller';

// External
import { NotificationModule } from '../notification/notification.module';
import { RbacModule } from '../rbac/rbac.module';
import { UserModule } from '../user/user.module';
import { PayrollModule } from '../payroll/payroll.module';
import { DocumentModule } from '../document/document.module';
import { LetterSharedModule } from '../letter-management/shared/letter-shared.module';
import { LetterTemplatesModule } from '../letter-management/templates/letter-templates.module';
import { SignatoriesModule } from '../letter-management/signatories/signatories.module';
import { CompanyPolicyModule } from '../company-policy/company-policy.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      OfferTemplate,
      OfferCandidate,
      Offer,
      OfferVersion,
      OfferTimeline,
      OfferApprovalStep,
      OfferSettings,
    ]),
    NotificationModule,
    RbacModule,
    UserModule,
    PayrollModule,
    DocumentModule,
    LetterSharedModule,
    LetterTemplatesModule,
    SignatoriesModule,
    CompanyPolicyModule,
  ],
  controllers: [
    OfferTemplateController,
    OfferCandidateController,
    OfferController,
    OfferPortalController,
    OfferApprovalController,
    OfferAnalyticsController,
    OfferSettingsController,
  ],
  providers: [
    // Repositories
    OfferTemplateRepository,
    OfferCandidateRepository,
    OfferRepository,
    OfferVersionRepository,
    OfferTimelineRepository,
    OfferSettingsRepository,
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
  ],
  exports: [OfferLifecycleService, OfferCandidateService, OfferSyncService],
})
export class OfferManagementModule {}
