import { Injectable, Logger } from '@nestjs/common';
import { NotificationRepository } from '../repositories/notification.repository';
import { SendNotificationDto } from '../dto/send-notification.dto';
import { Notification } from '../entities/notification.entity';
import { Status } from '../../../common/enums/status.enum';
import { LoggedInUser } from '../../auth/interfaces/logged-in-user.interface';
import { RedisService } from '../../../common/redis/redis.service';

@Injectable()
export class InAppNotificationService {
  private readonly logger = new Logger(InAppNotificationService.name);

  constructor(
    private readonly notificationRepository: NotificationRepository,
    private readonly redisService: RedisService,
  ) {}

  /**
   * Create an in-app notification record in the database.
   */
  async send(dto: SendNotificationDto, _user?: LoggedInUser): Promise<Notification | null> {
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
        status: Status.ACTIVE,
      });

      const saved = await this.notificationRepository.save(notification);
      this.logger.log(`In-App notification saved for user ${dto.user_id}`);

      // Publish to Redis so the SSE endpoint delivers it in real time
      await this.redisService.publish(
        `notifications:user:${dto.user_id}`,
        JSON.stringify({
          id: saved.id,
          title: saved.title,
          message: saved.message,
          type: saved.type,
          is_read: false,
          read_at: null,
          metadata: saved.metadata ?? null,
          created_at: saved.created_at,
          status: saved.status,
        }),
      );

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
  async getUnread(user: LoggedInUser): Promise<Notification[]> {
    return this.notificationRepository.findUnreadInApp(user.userId);
  }

  /**
   * Fetch all in-app notifications
   */
  async getAll(user: LoggedInUser): Promise<Notification[]> {
    return this.notificationRepository.findAllInApp(user.userId);
  }

  /**
   * Mark a notification as read
   */
  async markAsRead(id: string, user: LoggedInUser): Promise<void> {
    await this.notificationRepository.update(
      { id, user_id: user.userId },
      { is_read: true, read_at: new Date() },
    );
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(user: LoggedInUser): Promise<void> {
    await this.notificationRepository.update(
      { user_id: user.userId, is_read: false },
      { is_read: true, read_at: new Date() },
    );
  }

  /**
   * Count unread in-app notifications for a user
   */
  async getUnreadCount(user: LoggedInUser): Promise<number> {
    return this.notificationRepository.countUnreadInApp(user.userId);
  }
}
