import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { PushSubscription } from '../entities/push-subscription.entity';

@Injectable()
export class PushSubscriptionRepository {
  constructor(
    @InjectRepository(PushSubscription)
    private readonly repo: Repository<PushSubscription>,
  ) {}

  findByUserId(userId: string): Promise<PushSubscription[]> {
    return this.repo.find({ where: { user_id: userId } });
  }

  async upsert(
    userId: string,
    endpoint: string,
    p256dh: string,
    auth: string,
    platform = 'web',
  ): Promise<PushSubscription> {
    const existing = await this.repo.findOne({ where: { endpoint } });
    if (existing) {
      existing.user_id = userId;
      existing.p256dh = p256dh;
      existing.auth = auth;
      return this.repo.save(existing);
    }
    return this.repo.save(this.repo.create({ user_id: userId, endpoint, p256dh, auth, platform }));
  }

  async deleteByEndpoint(endpoint: string): Promise<void> {
    await this.repo.delete({ endpoint });
  }

  async deleteByUserAndEndpoint(userId: string, endpoint: string): Promise<void> {
    await this.repo.delete({ user_id: userId, endpoint });
  }
}
