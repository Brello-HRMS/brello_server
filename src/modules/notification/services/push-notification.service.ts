import { readFileSync } from 'fs';
import { join } from 'path';

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import * as webpush from 'web-push';

import { SendNotificationDto } from '../dto/send-notification.dto';
import { PushSubscriptionRepository } from '../repositories/push-subscription.repository';

const FCM_STALE_ERRORS = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
]);

function flattenToStringRecord(obj: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(obj)
      .filter(([, v]) => v !== null && v !== undefined)
      .map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)]),
  );
}

@Injectable()
export class PushNotificationService {
  private readonly logger = new Logger(PushNotificationService.name);

  constructor(
    private readonly pushSubRepo: PushSubscriptionRepository,
    private readonly configService: ConfigService,
  ) {
    // Web Push (VAPID)
    const publicKey = this.configService.get<string>('vapid.public_key');
    const privateKey = this.configService.get<string>('vapid.private_key');
    const email = this.configService.get<string>('vapid.email', 'mailto:admin@brello.io');
    if (publicKey && privateKey) {
      webpush.setVapidDetails(email, publicKey, privateKey);
    } else {
      this.logger.warn('VAPID keys not configured — web push disabled');
    }

    // Firebase Admin (FCM)
    const serviceAccountPath = this.configService.get<string>('firebase.service_account_path');
    if (serviceAccountPath && !admin.apps.length) {
      try {
        const raw = readFileSync(join(process.cwd(), serviceAccountPath), 'utf8');
        const serviceAccount = JSON.parse(raw) as admin.ServiceAccount;
        admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
        this.logger.log('Firebase Admin initialised — FCM push enabled');
      } catch (err: any) {
        this.logger.warn(`Firebase Admin init failed: ${err.message} — FCM push disabled`);
      }
    } else if (!serviceAccountPath) {
      this.logger.warn('firebase.service_account_path not set — FCM push disabled');
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

    const webPayload = JSON.stringify({
      title: dto.title,
      body: dto.message,
      data: dto.metadata ?? {},
    });

    await Promise.allSettled(
      subscriptions.map(async (sub) => {
        if (sub.platform === 'web') {
          await this.sendWebPush(sub.endpoint, sub.p256dh, sub.auth, webPayload);
        } else {
          await this.sendFcm(sub.endpoint, sub.platform, dto);
        }
      }),
    );
  }

  private async sendWebPush(
    endpoint: string,
    p256dh: string | null,
    auth: string | null,
    payload: string,
  ): Promise<void> {
    if (!p256dh || !auth) {
      this.logger.warn(`Web push subscription missing keys for endpoint ${endpoint.slice(0, 40)}... — skipping`);
      return;
    }
    try {
      await webpush.sendNotification({ endpoint, keys: { p256dh, auth } }, payload);
      this.logger.log(`Web push sent to ${endpoint.slice(0, 40)}...`);
    } catch (err: any) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        this.logger.warn(`Stale web push endpoint removed: ${endpoint.slice(0, 40)}...`);
        await this.pushSubRepo.deleteByEndpoint(endpoint);
      } else {
        this.logger.error(`Web push delivery failed: ${err.message}`);
        throw err;
      }
    }
  }

  private async sendFcm(
    fcmToken: string,
    platform: string,
    dto: SendNotificationDto,
  ): Promise<void> {
    if (!admin.apps.length) {
      this.logger.warn('Firebase Admin not initialised — skipping FCM push');
      return;
    }
    try {
      await admin.messaging().send({
        token: fcmToken,
        notification: { title: dto.title, body: dto.message },
        data: flattenToStringRecord((dto.metadata ?? {}) as Record<string, unknown>),
        android: { priority: 'high' },
        apns: { payload: { aps: { sound: 'default', badge: 1 } } },
      });
      this.logger.log(`FCM push sent to ${platform} token ${fcmToken.slice(0, 20)}...`);
    } catch (err: any) {
      if (FCM_STALE_ERRORS.has(err.errorInfo?.code)) {
        this.logger.warn(`Stale FCM token removed: ${fcmToken.slice(0, 20)}...`);
        await this.pushSubRepo.deleteByEndpoint(fcmToken);
      } else {
        this.logger.error(`FCM delivery failed: ${err.message}`);
        throw err;
      }
    }
  }
}
