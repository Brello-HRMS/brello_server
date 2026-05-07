import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LeaveBalance } from './entities/leave-balance.entity';
import { LeaveBalanceLedger } from './entities/leave-balance-ledger.entity';
import { LeaveBalanceRepository } from './repositories/leave-balance.repository';
import { LeaveBalanceLedgerRepository } from './repositories/leave-balance-ledger.repository';
import { LeaveBalanceService } from './services/leave-balance.service';
import { LeaveBalanceController } from './controllers/leave-balance.controller';
import { LeaveConfig } from '../leave-config/entities/leave-config.entity';
import { LeaveType } from '../leave-config/entities/leave-type.entity';
import { User } from '../user/entities/user.entity';
import { LeaveRequest } from '../leave-request/entities/leave-request.entity';
import { RbacModule } from '../rbac/rbac.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      LeaveBalance,
      LeaveBalanceLedger,
      LeaveConfig,
      LeaveType,
      User,
      LeaveRequest,
    ]),
    RbacModule,
  ],
  controllers: [LeaveBalanceController],
  providers: [
    LeaveBalanceRepository,
    LeaveBalanceLedgerRepository,
    LeaveBalanceService,
  ],
  exports: [LeaveBalanceService],
})
export class LeaveBalanceModule {}
