import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { FeedbackTicket } from './entities/feedback-ticket.entity';
import { FeedbackComment } from './entities/feedback-comment.entity';
import { FeedbackStatusLog } from './entities/feedback-status-log.entity';

import { FeedbackTicketRepository } from './repositories/feedback-ticket.repository';
import { FeedbackCommentRepository } from './repositories/feedback-comment.repository';
import { FeedbackStatusLogRepository } from './repositories/feedback-status-log.repository';

import { FeedbackService } from './services/feedback.service';
import { PlatformFeedbackService } from './services/platform-feedback.service';

import { FeedbackController } from './controllers/feedback.controller';
import { PlatformFeedbackController } from './controllers/platform-feedback.controller';

import { NotificationModule } from '../notification/notification.module';
import { RbacModule } from '../rbac/rbac.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([FeedbackTicket, FeedbackComment, FeedbackStatusLog]),
    NotificationModule,
    RbacModule,
  ],
  controllers: [FeedbackController, PlatformFeedbackController],
  providers: [
    FeedbackTicketRepository,
    FeedbackCommentRepository,
    FeedbackStatusLogRepository,
    FeedbackService,
    PlatformFeedbackService,
  ],
})
export class FeedbackModule {}
