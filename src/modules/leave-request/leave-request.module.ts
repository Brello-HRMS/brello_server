import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LeaveRequest } from './entities/leave-request.entity';
import { LeaveRequestHistory } from './entities/leave-request-history.entity';
import { LeaveRequestRepository } from './repositories/leave-request.repository';
import { LeaveRequestHistoryRepository } from './repositories/leave-request-history.repository';
import { LeaveRequestService } from './services/leave-request.service';
import { LeaveRequestController } from './controllers/leave-request.controller';
import { LeaveType } from '../leave-config/entities/leave-type.entity';
import { LeaveConfig } from '../leave-config/entities/leave-config.entity';
import { LeaveRules } from '../leave-config/entities/leave-rules.entity';
import { User } from '../user/entities/user.entity';
import { LeaveBalanceModule } from '../leave-balance/leave-balance.module';
import { RbacModule } from '../rbac/rbac.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      LeaveRequest,
      LeaveRequestHistory,
      LeaveType,
      LeaveConfig,
      LeaveRules,
      User,
    ]),
    LeaveBalanceModule,
    RbacModule,
  ],
  controllers: [LeaveRequestController],
  providers: [
    LeaveRequestRepository,
    LeaveRequestHistoryRepository,
    LeaveRequestService,
  ],
  exports: [LeaveRequestService],
})
export class LeaveRequestModule {}
