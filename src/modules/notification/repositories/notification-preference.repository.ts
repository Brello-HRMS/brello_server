import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { NotificationType } from '../../../common/enums/notification-type.enum';
import { NotificationPreference } from '../entities/notification-preference.entity';

@Injectable()
export class NotificationPreferenceRepository {
  constructor(
    @InjectRepository(NotificationPreference)
    private readonly repo: Repository<NotificationPreference>,
  ) {}

  findAll(userId: string): Promise<NotificationPreference[]> {
    return this.repo.find({ where: { user_id: userId } });
  }

  findPreference(
    userId: string,
    channel: NotificationType,
    eventType: string,
  ): Promise<NotificationPreference | null> {
    return this.repo.findOne({
      where: { user_id: userId, channel, event_type: eventType },
    });
  }

  async upsert(
    userId: string,
    channel: NotificationType,
    eventType: string,
    enabled: boolean,
  ): Promise<NotificationPreference> {
    const existing = await this.findPreference(userId, channel, eventType);
    if (existing) {
      existing.enabled = enabled;
      return this.repo.save(existing);
    }
    return this.repo.save(
      this.repo.create({ user_id: userId, channel, event_type: eventType, enabled }),
    );
  }
}
