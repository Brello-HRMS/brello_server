import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';

import { Invoice } from './entities/invoice.entity';
import { InvoiceLineItem } from './entities/invoice-line-item.entity';
import { Payment } from './entities/payment.entity';
import { BillingProfile } from './entities/billing-profile.entity';
import { UserProfile } from '../user/entities/user-profile.entity';
import { OrganizationProfile } from '../organization/entities/organization-profile.entity';
import { OrganizationSubscription } from '../plan/entities/organization-subscription.entity';
import { Plan } from '../plan/entities/plan.entity';

import { InvoiceRepository } from './repositories/invoice.repository';
import { PaymentRepository } from './repositories/payment.repository';
import { BillingProfileRepository } from './repositories/billing-profile.repository';

import { EmployeeCountService } from './services/employee-count.service';
import { GstCalculatorService } from './services/gst-calculator.service';
import { RazorpayService } from './services/razorpay.service';
import { BillingProfileService } from './services/billing-profile.service';
import { InvoiceService } from './services/invoice.service';
import { InvoicePdfService } from './services/invoice-pdf.service';
import { PaymentService } from './services/payment.service';
import { SubscriptionBillingService } from './services/subscription-billing.service';
import { BillingOverviewService } from './services/billing-overview.service';
import { PlanComparisonService } from './services/plan-comparison.service';

import { BillingOverviewController } from './controllers/billing-overview.controller';
import { SubscriptionController } from './controllers/subscription.controller';
import { InvoiceController } from './controllers/invoice.controller';
import { PaymentController } from './controllers/payment.controller';
import { BillingProfileController } from './controllers/billing-profile.controller';
import { RazorpayWebhookController } from './controllers/razorpay-webhook.controller';

import { ActiveSubscriptionGuard } from './guards/active-subscription.guard';

import { RenewalInvoiceCron } from './crons/renewal-invoice.cron';
import { SubscriptionExpiryCron } from './crons/subscription-expiry.cron';
import { TrialReminderCron } from './crons/trial-reminder.cron';

import { PlanModule } from '../plan/plan.module';
import { DocumentModule } from '../document/document.module';
import { NotificationModule } from '../notification/notification.module';
import { UserRoleMap } from '../rbac/entities/user-role-map.entity';
import { User } from '../user/entities/user.entity';
import { RbacModule } from '../rbac/rbac.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Invoice,
      InvoiceLineItem,
      Payment,
      BillingProfile,
      UserProfile,
      OrganizationProfile,
      OrganizationSubscription,
      Plan,
      UserRoleMap,
      User,
    ]),
    ConfigModule,
    forwardRef(() => PlanModule),
    DocumentModule,
    NotificationModule,
    RbacModule,
  ],
  controllers: [
    BillingOverviewController,
    SubscriptionController,
    InvoiceController,
    PaymentController,
    BillingProfileController,
    RazorpayWebhookController,
  ],
  providers: [
    InvoiceRepository,
    PaymentRepository,
    BillingProfileRepository,
    EmployeeCountService,
    GstCalculatorService,
    RazorpayService,
    BillingProfileService,
    InvoiceService,
    InvoicePdfService,
    PaymentService,
    SubscriptionBillingService,
    BillingOverviewService,
    PlanComparisonService,
    RenewalInvoiceCron,
    SubscriptionExpiryCron,
    TrialReminderCron,
    {
      provide: APP_GUARD,
      useClass: ActiveSubscriptionGuard,
    },
  ],
  exports: [
    InvoiceService,
    PaymentService,
    SubscriptionBillingService,
    BillingOverviewService,
    EmployeeCountService,
    GstCalculatorService,
    BillingProfileService,
  ],
})
export class BillingModule {}
