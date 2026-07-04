import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationRepository } from './repositories/notification.repository';
import { NotificationPreferenceRepository } from './repositories/notification-preference.repository';
import { PushSubscriptionRepository } from './repositories/push-subscription.repository';
import { EmailNotificationService } from './services/email-notification.service';
import { InAppNotificationService } from './services/in-app-notification.service';
import { NotificationService } from './services/notification.service';
import { PushNotificationService } from './services/push-notification.service';
import { NotificationController } from './controllers/notification.controller';
import { SseController } from './controllers/sse.controller';
import { RedisModule } from '../../common/redis/redis.module';
import { SseJwtGuard } from '../../common/guards/sse-jwt.guard';
import { QueueModule } from '../queue/queue.module';
import { InAppWorker } from './workers/in-app.worker';
import { EmailWorker } from './workers/email.worker';
import { PushWorker } from './workers/push.worker';
import { Notification } from './entities/notification.entity';
import { NotificationPreference } from './entities/notification-preference.entity';
import { PushSubscription } from './entities/push-subscription.entity';

@Module({
  imports: [
    ConfigModule,
    RedisModule,
    QueueModule,
    TypeOrmModule.forFeature([Notification, NotificationPreference, PushSubscription]),
  ],
  controllers: [NotificationController, SseController],
  providers: [
    NotificationRepository,
    NotificationPreferenceRepository,
    PushSubscriptionRepository,
    EmailNotificationService,
    InAppNotificationService,
    PushNotificationService,
    NotificationService,
    SseJwtGuard,
    InAppWorker,
    EmailWorker,
    PushWorker,
  ],
  exports: [NotificationService],
})
export class NotificationModule {}
