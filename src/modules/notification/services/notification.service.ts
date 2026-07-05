import { Inject, Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';

import { DEFAULT_JOB_OPTIONS, QUEUE_TOKENS } from '../../queue/queue.constants';
import { NotificationType } from '../../../common/enums/notification-type.enum';
import { NotificationEventType } from '../../../common/enums/notification-event-type.enum';
import { SendNotificationDto } from '../dto/send-notification.dto';
import { NotificationPreferenceRepository } from '../repositories/notification-preference.repository';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @Inject(QUEUE_TOKENS.EMAIL) private readonly emailQueue: Queue,
    @Inject(QUEUE_TOKENS.IN_APP) private readonly inAppQueue: Queue,
    @Inject(QUEUE_TOKENS.PUSH) private readonly pushQueue: Queue,
    private readonly preferenceRepository: NotificationPreferenceRepository,
  ) {}

  /**
   * Enqueues a notification job for async processing by the appropriate worker.
   * Checks user preferences before enqueuing — silently skips disabled channels.
   * Auth OTPs always bypass the preference gate.
   */
  async send(dto: SendNotificationDto): Promise<void> {
    this.logger.log(`Enqueuing notification type: ${dto.type} for user: ${dto.user_id}`);

    // Preference gate — skip if user has disabled this event/channel combination
    const eventType = dto.event_type ?? (dto.metadata?.event_type as string | undefined);
    if (eventType && eventType !== NotificationEventType.AUTH_OTP && dto.user_id) {
      const pref = await this.preferenceRepository.findPreference(dto.user_id, dto.type, eventType);
      if (pref && !pref.enabled) {
        this.logger.debug(`Skipping ${dto.type} for user ${dto.user_id}: event_type=${eventType} is disabled`);
        return;
      }
    }

    switch (dto.type) {
      case NotificationType.EMAIL:
        await this.emailQueue.add('send', dto, DEFAULT_JOB_OPTIONS);
        break;

      case NotificationType.IN_APP:
        await this.inAppQueue.add('send', dto, DEFAULT_JOB_OPTIONS);
        break;

      case NotificationType.PUSH:
        await this.pushQueue.add('send', dto, DEFAULT_JOB_OPTIONS);
        break;

      default:
        this.logger.error(`Unknown notification type: ${dto.type}`);
        throw new Error(`Unsupported Notification Type: ${dto.type}`);
    }
  }

  /**
   * Enqueues jobs to all three channels concurrently.
   */
  async broadcastAllChannels(dto: Omit<SendNotificationDto, 'type'>): Promise<void> {
    this.logger.log(`Broadcasting to all channels for user: ${dto.user_id}`);

    await Promise.allSettled([
      this.inAppQueue.add('send', { ...dto, type: NotificationType.IN_APP }, DEFAULT_JOB_OPTIONS),
      this.pushQueue.add('send', { ...dto, type: NotificationType.PUSH }, DEFAULT_JOB_OPTIONS),
      dto.target_email
        ? this.emailQueue.add('send', { ...dto, type: NotificationType.EMAIL }, DEFAULT_JOB_OPTIONS)
        : Promise.resolve(),
    ]);
  }
}
