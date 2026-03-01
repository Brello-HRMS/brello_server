import { Injectable, Logger } from '@nestjs/common';
import { SendNotificationDto } from '../dto/send-notification.dto';

@Injectable()
export class PushNotificationService {
  private readonly logger = new Logger(PushNotificationService.name);

  /**
   * Send a push notification (FCM, APN, Web Push)
   *
   * Note: This is a placeholder for actual Push service integration (e.g., Firebase Admin SDK)
   */
  async send(dto: SendNotificationDto): Promise<void> {
    if (!dto.user_id) {
      this.logger.error('Cannot send PUSH notification: missing user_id');
      return;
    }

    try {
      // TODO: Implement actual Push provider logic
      // e.g., lookup user's registered device tokens (FCM tokens), construct payload, fire to FCM

      this.logger.log(
        `[PUSH MOCK] Push notification sent to user ${dto.user_id}: ${dto.title}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send PUSH notification: ${error.message}`,
        error.stack,
      );
    }
  }
}
