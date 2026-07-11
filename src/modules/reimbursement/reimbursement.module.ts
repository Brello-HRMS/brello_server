import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationModule } from '../notification/notification.module';

import { Reimbursement } from './entities/reimbursement.entity';
import { ReimbursementAttachment } from './entities/reimbursement-attachment.entity';
import { User } from '../user/entities/user.entity';
import { UserProfile } from '../user/entities/user-profile.entity';
import { Document } from '../document/entities/document.entity';

import { GlobalSearchModule } from '../global-search/global-search.module';
import { ReimbursementRepository } from './repositories/reimbursement.repository';
import { ReimbursementService } from './services/reimbursement.service';
import { AdminReimbursementService } from './services/admin-reimbursement.service';
import { ReimbursementController } from './controllers/reimbursement.controller';
import { AdminReimbursementController } from './controllers/admin-reimbursement.controller';
import { RbacModule } from '../rbac/rbac.module';

@Module({
  imports: [
    GlobalSearchModule,
    TypeOrmModule.forFeature([
      Reimbursement,
      ReimbursementAttachment,
      User,
      UserProfile,
      Document,
    ]),
    NotificationModule,
    RbacModule,
  ],
  controllers: [ReimbursementController, AdminReimbursementController],
  providers: [
    ReimbursementRepository,
    ReimbursementService,
    AdminReimbursementService,
  ],
  exports: [ReimbursementService, AdminReimbursementService],
})
export class ReimbursementModule {}
