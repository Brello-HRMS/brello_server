import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Announcement } from './entities/announcement.entity';
import { AnnouncementTarget } from './entities/announcement-target.entity';
import { AnnouncementRead } from './entities/announcement-read.entity';
import { AnnouncementAttachment } from './entities/announcement-attachment.entity';
import { User } from '../user/entities/user.entity';

import { GlobalSearchModule } from '../global-search/global-search.module';
import { RbacModule } from '../rbac/rbac.module';
import { NotificationModule } from '../notification/notification.module';
import { AnnouncementRepository } from './repositories/announcement.repository';
import { AnnouncementService } from './services/announcement.service';
import { AnnouncementNotificationService } from './services/announcement-notification.service';
import { AnnouncementSchedulerService } from './services/announcement-scheduler.service';
import { EmployeeAnnouncementService } from './services/employee-announcement.service';
import { AnnouncementController } from './controllers/announcement.controller';
import { EmployeeAnnouncementController } from './controllers/employee-announcement.controller';

@Module({
  imports: [
    GlobalSearchModule,
    RbacModule,
    NotificationModule,
    TypeOrmModule.forFeature([
      Announcement,
      AnnouncementTarget,
      AnnouncementRead,
      AnnouncementAttachment,
      User,
    ]),
  ],
  controllers: [AnnouncementController, EmployeeAnnouncementController],
  providers: [
    AnnouncementRepository,
    AnnouncementService,
    AnnouncementNotificationService,
    AnnouncementSchedulerService,
    EmployeeAnnouncementService,
  ],
  exports: [AnnouncementService, EmployeeAnnouncementService],
})
export class AnnouncementModule {}
