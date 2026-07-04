import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as webpush from 'web-push';

import { SendNotificationDto } from '../dto/send-notification.dto';
import { PushSubscriptionRepository } from '../repositories/push-subscription.repository';

@Injectable()
export class PushNotificationService {
  private readonly logger = new Logger(PushNotificationService.name);

  constructor(
    private readonly pushSubRepo: PushSubscriptionRepository,
    private readonly configService: ConfigService,
  ) {
    const publicKey = this.configService.get<string>('vapid.public_key');
    const privateKey = this.configService.get<string>('vapid.private_key');
    const email = this.configService.get<string>('vapid.email', 'mailto:admin@brello.io');

    if (publicKey && privateKey) {
      webpush.setVapidDetails(email, publicKey, privateKey);
    } else {
      this.logger.warn('VAPID keys not configured — push notifications disabled');
    }
  }

  getVapidPublicKey(): string | undefined {
    return this.configService.get<string>('vapid.public_key');
  }

  async send(dto: SendNotificationDto): Promise<void> {
    if (!dto.user_id) {
      this.logger.error('Cannot send PUSH notification: missing user_id');
      return;
    }

    const subscriptions = await this.pushSubRepo.findByUserId(dto.user_id);
    if (!subscriptions.length) return;

    const payload = JSON.stringify({
      title: dto.title,
      body: dto.message,
      data: dto.metadata ?? {},
    });

    await Promise.allSettled(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload,
          );
          this.logger.log(`Push sent to user ${dto.user_id}: endpoint ${sub.endpoint.slice(0, 40)}...`);
        } catch (err: any) {
          if (err.statusCode === 410 || err.statusCode === 404) {
            this.logger.warn(`Stale push endpoint removed: ${sub.endpoint.slice(0, 40)}...`);
            await this.pushSubRepo.deleteByEndpoint(sub.endpoint);
          } else {
            this.logger.error(`Push delivery failed: ${err.message}`);
            throw err; // re-throw for BullMQ retry
          }
        }
      }),
    );
  }
}
