import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Reimbursement } from './entities/reimbursement.entity';
import { ReimbursementAttachment } from './entities/reimbursement-attachment.entity';
import { ReimbursementAuditLog } from './entities/reimbursement-audit-log.entity';
import { User } from '../user/entities/user.entity';
import { UserProfile } from '../user/entities/user-profile.entity';
import { Document } from '../document/entities/document.entity';

import { ReimbursementRepository } from './repositories/reimbursement.repository';
import { ReimbursementService } from './services/reimbursement.service';
import { AdminReimbursementService } from './services/admin-reimbursement.service';
import { ReimbursementController } from './controllers/reimbursement.controller';
import { AdminReimbursementController } from './controllers/admin-reimbursement.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Reimbursement,
      ReimbursementAttachment,
      ReimbursementAuditLog,
      User,
      UserProfile,
      Document,
    ]),
  ],
  controllers: [ReimbursementController, AdminReimbursementController],
  providers: [ReimbursementRepository, ReimbursementService, AdminReimbursementService],
  exports: [ReimbursementService, AdminReimbursementService],
})
export class ReimbursementModule {}
