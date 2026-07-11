import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AnnouncementService } from './announcement.service';

@Injectable()
export class AnnouncementSchedulerService {
  private readonly logger = new Logger(AnnouncementSchedulerService.name);

  constructor(private readonly announcementService: AnnouncementService) {}

  /** Publishes any SCHEDULED announcement whose scheduled_at has arrived. */
  @Cron(CronExpression.EVERY_MINUTE)
  async publishDueScheduledAnnouncements(): Promise<void> {
    const count = await this.announcementService.publishDueScheduled();
    if (count > 0) {
      this.logger.log(`Auto-published ${count} scheduled announcement(s)`);
    }
  }
}
