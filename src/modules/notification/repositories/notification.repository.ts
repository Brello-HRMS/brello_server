import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Notification } from '../entities/notification.entity';
import { Status } from '../../../common/enums/status.enum';

@Injectable()
export class NotificationRepository extends Repository<Notification> {
  constructor(private dataSource: DataSource) {
    super(Notification, dataSource.createEntityManager());
  }

  // Find all active unread in-app notifications for a user
  async findUnreadInApp(userId: string): Promise<Notification[]> {
    return this.createQueryBuilder('notification')
      .where('notification.user_id = :userId', { userId })
      .andWhere('notification.type = :type', { type: 'IN_APP' })
      .andWhere('notification.is_read = :isRead', { isRead: false })
      .andWhere('notification.status = :status', { status: Status.ACTIVE })
      .orderBy('notification.created_at', 'DESC')
      .getMany();
  }

  // Find all active in-app notifications for a user
  async findAllInApp(userId: string): Promise<Notification[]> {
    return this.createQueryBuilder('notification')
      .where('notification.user_id = :userId', { userId })
      .andWhere('notification.type = :type', { type: 'IN_APP' })
      .andWhere('notification.status = :status', { status: Status.ACTIVE })
      .orderBy('notification.created_at', 'DESC')
      .getMany();
  }
}
