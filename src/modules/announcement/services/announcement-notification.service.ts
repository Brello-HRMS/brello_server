import { Injectable } from '@nestjs/common';
import { NotificationService } from '../../notification/services/notification.service';
import { NotificationType } from '../../../common/enums/notification-type.enum';
import { NotificationEventType } from '../../../common/enums/notification-event-type.enum';
import type { Announcement } from '../entities/announcement.entity';

export interface AnnouncementRecipient {
  id: string;
  email: string;
}

@Injectable()
export class AnnouncementNotificationService {
  constructor(private readonly notificationService: NotificationService) {}

  /**
   * Fans a "published" notification out to every recipient, honoring the
   * announcement's own send_push/send_email toggles. In-app is unconditional
   * (there's no send_in_app flag on the entity — it's the baseline channel).
   */
  async notifyPublished(
    announcement: Announcement,
    recipients: AnnouncementRecipient[],
  ): Promise<void> {
    const title = `📢 ${announcement.title}`;
    const message = this.excerpt(announcement.description_html);
    const metadata = {
      announcement_id: announcement.id,
      priority: announcement.priority,
    };

    await Promise.allSettled(
      recipients.flatMap((recipient) => {
        const jobs: Promise<void>[] = [
          this.notificationService.send({
            user_id: recipient.id,
            title,
            message,
            type: NotificationType.IN_APP,
            event_type: NotificationEventType.ANNOUNCEMENT_PUBLISHED,
            metadata,
          }),
        ];

        if (announcement.send_push) {
          jobs.push(
            this.notificationService.send({
              user_id: recipient.id,
              title,
              message,
              type: NotificationType.PUSH,
              event_type: NotificationEventType.ANNOUNCEMENT_PUBLISHED,
              metadata,
            }),
          );
        }

        if (announcement.send_email && recipient.email) {
          jobs.push(
            this.notificationService.send({
              target_email: recipient.email,
              title,
              message,
              type: NotificationType.EMAIL,
              event_type: NotificationEventType.ANNOUNCEMENT_PUBLISHED,
              metadata,
            }),
          );
        }

        return jobs;
      }),
    );
  }

  private excerpt(html: string): string {
    const text = html
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return text.length > 200 ? `${text.slice(0, 200)}…` : text;
  }
}
