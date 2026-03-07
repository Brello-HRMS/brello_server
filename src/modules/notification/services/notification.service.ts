import { Injectable, Logger } from '@nestjs/common';
import { EmailNotificationService } from './email-notification.service';
import { InAppNotificationService } from './in-app-notification.service';
import { PushNotificationService } from './push-notification.service';
import { SendNotificationDto } from '../dto/send-notification.dto';
import { NotificationType } from '../../../common/enums/notification-type.enum';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly emailService: EmailNotificationService,
    private readonly inAppService: InAppNotificationService,
    private readonly pushService: PushNotificationService,
  ) {}

  /**
   * Facade entry point for dispatching notifications.
   * Routes the payload to the correct underlying provider based on 'type'.
   */
  async send(dto: SendNotificationDto): Promise<any> {
    this.logger.log(`Dispatching notification type: ${dto.type}`);

    switch (dto.type) {
      case NotificationType.EMAIL:
        return this.emailService.send(dto);

      case NotificationType.IN_APP:
        return this.inAppService.send(dto);

      case NotificationType.PUSH:
        return this.pushService.send(dto);

      default:
        this.logger.error(`Unknown notification type: ${dto.type}`);
        throw new Error(`Unsupported Notification Type: ${dto.type}`);
    }
  }

  /**
   * Broadcast utility to easily send to all channels at once
   */
  async broadcastAllChannels(
    dto: Omit<SendNotificationDto, 'type'>,
  ): Promise<void> {
    this.logger.log(
      `Broadcasting notification to all channels for user: ${dto.user_id}`,
    );

    // Fire off all promises concurrently
    await Promise.allSettled([
      this.inAppService.send({ ...dto, type: NotificationType.IN_APP }),
      this.pushService.send({ ...dto, type: NotificationType.PUSH }),
      dto.target_email
        ? this.emailService.send({ ...dto, type: NotificationType.EMAIL })
        : Promise.resolve(),
    ]);
  }
}
