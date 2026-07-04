import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NotificationRepository } from './repositories/notification.repository';
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

@Module({
  imports: [ConfigModule, RedisModule, QueueModule],
  controllers: [NotificationController, SseController],
  providers: [
    NotificationRepository,
    EmailNotificationService,
    InAppNotificationService,
    PushNotificationService,
    NotificationService,
    SseJwtGuard,
    InAppWorker,
    EmailWorker,
    PushWorker,
  ],
  exports: [NotificationService], // Export Facade for other modules to consume
})
export class NotificationModule {}
