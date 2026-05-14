import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Shift } from './entities/shift.entity';
import { WeeklyOff } from './entities/weekly-off.entity';
import { AttendanceRule } from './entities/attendance-rule.entity';
import { GeoFence } from './entities/geo-fence.entity';
import { RuleAssignment } from './entities/rule-assignment.entity';
import { AttendanceRecord } from './entities/attendance-record.entity';
import { AttendanceSession } from './entities/attendance-session.entity';
import { AttendanceAuditLog } from './entities/attendance-audit-log.entity';
import { RemoteApproval } from './entities/remote-approval.entity';
import { User } from '../user/entities/user.entity';
import { ShiftRepository } from './repositories/shift.repository';
import { WeeklyOffRepository } from './repositories/weekly-off.repository';
import { AttendanceRuleRepository } from './repositories/attendance-rule.repository';
import { RuleAssignmentRepository } from './repositories/rule-assignment.repository';
import { AttendanceRecordRepository } from './repositories/attendance-record.repository';
import { AttendanceSessionRepository } from './repositories/attendance-session.repository';
import { AttendanceAuditLogRepository } from './repositories/attendance-audit-log.repository';
import { RemoteApprovalRepository } from './repositories/remote-approval.repository';
import { ShiftService } from './services/shift.service';
import { WeeklyOffService } from './services/weekly-off.service';
import { AttendanceRuleService } from './services/attendance-rule.service';
import { RuleAssignmentService } from './services/rule-assignment.service';
import { GeoValidationService } from './services/geo-validation.service';
import { AttendanceService } from './services/attendance.service';
import { AdminAttendanceService } from './services/admin-attendance.service';
import { RemoteApprovalService } from './services/remote-approval.service';
import { AttendanceRuleResolverService } from './services/attendance-rule-resolver.service';
import { ShiftController } from './controllers/shift.controller';
import { WeeklyOffController } from './controllers/weekly-off.controller';
import { AttendanceRuleController } from './controllers/attendance-rule.controller';
import { RuleAssignmentController } from './controllers/rule-assignment.controller';
import { GeoValidationController } from './controllers/geo-validation.controller';
import { AttendanceController } from './controllers/attendance.controller';
import { AdminAttendanceController } from './controllers/admin-attendance.controller';
import { RbacModule } from '../rbac/rbac.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Shift,
      WeeklyOff,
      AttendanceRule,
      GeoFence,
      RuleAssignment,
      AttendanceRecord,
      AttendanceSession,
      AttendanceAuditLog,
      RemoteApproval,
      User,
    ]),
    RbacModule,
  ],
  controllers: [
    ShiftController,
    WeeklyOffController,
    AttendanceRuleController,
    RuleAssignmentController,
    GeoValidationController,
    AttendanceController,
    AdminAttendanceController,
  ],
  providers: [
    ShiftService,
    WeeklyOffService,
    AttendanceRuleService,
    RuleAssignmentService,
    GeoValidationService,
    AttendanceService,
    AdminAttendanceService,
    RemoteApprovalService,
    AttendanceRuleResolverService,
    ShiftRepository,
    WeeklyOffRepository,
    AttendanceRuleRepository,
    RuleAssignmentRepository,
    AttendanceRecordRepository,
    AttendanceSessionRepository,
    AttendanceAuditLogRepository,
    RemoteApprovalRepository,
  ],
  exports: [
    ShiftService,
    WeeklyOffService,
    AttendanceRuleService,
    RuleAssignmentService,
    GeoValidationService,
    AttendanceService,
  ],
})
export class AttendanceModule {}
