import { Injectable, Logger } from '@nestjs/common';
import { NotificationRepository } from '../repositories/notification.repository';
import { SendNotificationDto } from '../dto/send-notification.dto';
import { Notification } from '../entities/notification.entity';
import { Status } from '../../../common/enums/status.enum';

@Injectable()
export class InAppNotificationService {
  private readonly logger = new Logger(InAppNotificationService.name);

  constructor(
    private readonly notificationRepository: NotificationRepository,
  ) {}

  /**
   * Create an in-app notification record in the database.
   */
  async send(dto: SendNotificationDto): Promise<Notification | null> {
    if (!dto.user_id) {
      this.logger.error('Cannot create IN_APP notification: missing user_id');
      return null;
    }

    try {
      const notification = this.notificationRepository.create({
        user_id: dto.user_id,
        title: dto.title,
        message: dto.message,
        type: dto.type,
        is_read: false,
        metadata: dto.metadata,
        base_status: Status.ACTIVE,
      });

      const saved = await this.notificationRepository.save(notification);
      this.logger.log(`In-App notification saved for user ${dto.user_id}`);
      return saved;
    } catch (error) {
      this.logger.error(
        `Failed to save In-App notification: ${error.message}`,
        error.stack,
      );
      return null;
    }
  }

  /**
   * Fetch unread in-app notifications
   */
  async getUnread(userId: string): Promise<Notification[]> {
    return this.notificationRepository.findUnreadInApp(userId);
  }

  /**
   * Fetch all in-app notifications
   */
  async getAll(userId: string): Promise<Notification[]> {
    return this.notificationRepository.findAllInApp(userId);
  }

  /**
   * Mark a notification as read
   */
  async markAsRead(id: string, userId: string): Promise<void> {
    await this.notificationRepository.update(
      { id, user_id: userId },
      { is_read: true, read_at: new Date() },
    );
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string): Promise<void> {
    await this.notificationRepository.update(
      { user_id: userId, is_read: false },
      { is_read: true, read_at: new Date() },
    );
  }
}
