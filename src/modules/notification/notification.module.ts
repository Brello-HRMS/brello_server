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

@Module({
  imports: [ConfigModule, RedisModule],
  controllers: [NotificationController, SseController],
  providers: [
    NotificationRepository,
    EmailNotificationService,
    InAppNotificationService,
    PushNotificationService,
    NotificationService,
    SseJwtGuard,
  ],
  exports: [NotificationService], // Export Facade for other modules to consume
})
export class NotificationModule {}
