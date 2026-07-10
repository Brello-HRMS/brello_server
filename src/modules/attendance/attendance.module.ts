import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Shift } from './entities/shift.entity';
import { WeeklyOff } from './entities/weekly-off.entity';
import { AttendanceRule } from './entities/attendance-rule.entity';
import { GeoFence } from './entities/geo-fence.entity';
import { RuleAssignment } from './entities/rule-assignment.entity';
import { AttendanceRecord } from './entities/attendance-record.entity';
import { AttendanceSession } from './entities/attendance-session.entity';
import { RemoteApproval } from './entities/remote-approval.entity';
import { AttendanceCorrectionRequest } from './entities/attendance-correction-request.entity';
import { User } from '../user/entities/user.entity';
import { UserProfile } from '../user/entities/user-profile.entity';
import { Holiday } from '../holiday/entities/holiday.entity';
import { LeaveRequest } from '../leave-request/entities/leave-request.entity';
import { NotificationModule } from '../notification/notification.module';
import { AuditCoreModule } from '../audit/audit.module';
import { AttendanceMaterializationService } from './services/attendance-materialization.service';
import { AttendanceCronService } from './services/attendance-cron.service';
import { AutoCheckoutService } from './services/auto-checkout.service';
import { CorrectionRequestService } from './services/correction-request.service';
import { AttendanceCorrectionRequestRepository } from './repositories/attendance-correction-request.repository';
import {
  MyCorrectionRequestController,
  AdminCorrectionRequestController,
} from './controllers/correction-request.controller';
import { ShiftRepository } from './repositories/shift.repository';
import { WeeklyOffRepository } from './repositories/weekly-off.repository';
import { AttendanceRuleRepository } from './repositories/attendance-rule.repository';
import { RuleAssignmentRepository } from './repositories/rule-assignment.repository';
import { AttendanceRecordRepository } from './repositories/attendance-record.repository';
import { AttendanceSessionRepository } from './repositories/attendance-session.repository';
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
      RemoteApproval,
      AttendanceCorrectionRequest,
      User,
      UserProfile,
      Holiday,
      LeaveRequest,
    ]),
    RbacModule,
    NotificationModule,
    AuditCoreModule,
  ],
  controllers: [
    ShiftController,
    WeeklyOffController,
    AttendanceRuleController,
    RuleAssignmentController,
    GeoValidationController,
    AttendanceController,
    AdminAttendanceController,
    MyCorrectionRequestController,
    AdminCorrectionRequestController,
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
    AttendanceMaterializationService,
    AttendanceCronService,
    AutoCheckoutService,
    CorrectionRequestService,
    AttendanceCorrectionRequestRepository,
    ShiftRepository,
    WeeklyOffRepository,
    AttendanceRuleRepository,
    RuleAssignmentRepository,
    AttendanceRecordRepository,
    AttendanceSessionRepository,
    RemoteApprovalRepository,
  ],
  exports: [
    ShiftService,
    WeeklyOffService,
    AttendanceRuleService,
    RuleAssignmentService,
    GeoValidationService,
    AttendanceService,
    AttendanceMaterializationService,
  ],
})
export class AttendanceModule {}
