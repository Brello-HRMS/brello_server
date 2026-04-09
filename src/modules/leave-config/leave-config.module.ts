import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LeaveConfig } from './entities/leave-config.entity';
import { LeaveType } from './entities/leave-type.entity';
import { LeaveRules } from './entities/leave-rules.entity';
import { LeaveConfigRepository } from './repositories/leave-config.repository';
import { LeaveConfigService } from './services/leave-config.service';
import { LeaveConfigController } from './controllers/leave-config.controller';
import { RbacModule } from '../rbac/rbac.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      LeaveConfig,
      LeaveType,
      LeaveRules,
    ]),
    RbacModule,
  ],
  controllers: [LeaveConfigController],
  providers: [
    LeaveConfigService,
    LeaveConfigRepository,
  ],
  exports: [LeaveConfigService],
})
export class LeaveConfigModule {}
