import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OfferRepository } from '../repositories/offer.repository';
import { OfferSettingsRepository } from '../repositories/offer-settings.repository';
import { OfferTimelineRepository } from '../repositories/offer-timeline.repository';
import { OfferCandidateRepository } from '../repositories/offer-candidate.repository';

import { OfferVersionRepository } from '../repositories/offer-version.repository';
import { OfferNotificationService } from './offer-notification.service';
import { OfferStatus } from '../enums/offer-status.enum';
import { OfferTimelineEvent } from '../enums/offer-timeline-event.enum';

@Injectable()
export class OfferSchedulerService {
  private readonly logger = new Logger(OfferSchedulerService.name);

  constructor(
    private readonly offerRepo: OfferRepository,
    private readonly settingsRepo: OfferSettingsRepository,
    private readonly timelineRepo: OfferTimelineRepository,
    private readonly candidateRepo: OfferCandidateRepository,
    private readonly versionRepo: OfferVersionRepository,
    private readonly notificationService: OfferNotificationService,
  ) {}

  /** Run daily at 8 AM — expire stale offers. */
  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async expireStaleOffers(): Promise<void> {
    this.logger.log('Running offer expiry check...');
    const expired = await this.offerRepo.findExpired();
    this.logger.log(`Found ${expired.length} offers to expire`);

    for (const offer of expired) {
      await this.offerRepo.update(offer.id, {
        offer_status: OfferStatus.EXPIRED,
      });
      await this.timelineRepo.record({
        offer_id: offer.id,
        event: OfferTimelineEvent.OFFER_EXPIRED,
        label: 'Offer automatically expired',
        organization_id: offer.organization_id,
        enterprise_id: offer.enterprise_id,
      });
    }
  }

  /** Run daily at 9 AM — send reminder emails, honoring each org's configured reminder schedule. */
  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async sendReminderEmails(): Promise<void> {
    this.logger.log('Running offer reminder check...');

    const allSettings = await this.settingsRepo.findAll();
    const reminderDaysByOrg = new Map<string, number[]>(
      allSettings.map((s) => [s.organization_id, s.reminder_days_before_expiry]),
    );
    const distinctDays = [...new Set(allSettings.flatMap((s) => s.reminder_days_before_expiry))];

    await this.processRemindersForDays(distinctDays, reminderDaysByOrg);
  }

  private async processRemindersForDays(
    days: number[],
    reminderDaysByOrg: Map<string, number[]>,
  ): Promise<void> {
    for (const daysBefore of days) {
      const offers = await this.offerRepo.findNeedingReminder(daysBefore);
      this.logger.log(
        `Found ${offers.length} offers expiring in ${daysBefore} day(s)`,
      );

      for (const offer of offers) {
        const orgReminderDays = reminderDaysByOrg.get(offer.organization_id) ?? [3, 1];
        if (!orgReminderDays.includes(daysBefore)) continue;

        const candidate = await this.candidateRepo.findOneByOrg(
          offer.candidate_id,
          offer.organization_id,
        );
        if (!candidate) continue;

        const activeVersion = await this.versionRepo.findActiveByOffer(offer.id);
        if (!activeVersion) continue;

        await this.notificationService.sendReminderEmail({
          candidate,
          offer,
          portalLink: this.buildPortalLink(activeVersion.access_token),
        });

        await this.timelineRepo.record({
          offer_id: offer.id,
          event: OfferTimelineEvent.REMINDER_SENT,
          label: `Reminder sent (${daysBefore} day(s) before expiry)`,
          organization_id: offer.organization_id,
          enterprise_id: offer.enterprise_id,
        });
      }
    }
  }

  private buildPortalLink(token: string): string {
    const baseUrl = process.env.WEBAPP_URL ?? 'https://brellohrms.netlify.app';
    return `${baseUrl}/offer/portal/${token}`;
  }
}
