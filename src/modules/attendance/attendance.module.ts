import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Shift } from './entities/shift.entity';
import { WeeklyOff } from './entities/weekly-off.entity';
import { AttendanceRule } from './entities/attendance-rule.entity';
import { GeoFence } from './entities/geo-fence.entity';
import { RuleAssignment } from './entities/rule-assignment.entity';
import { ShiftRepository } from './repositories/shift.repository';
import { WeeklyOffRepository } from './repositories/weekly-off.repository';
import { AttendanceRuleRepository } from './repositories/attendance-rule.repository';
import { RuleAssignmentRepository } from './repositories/rule-assignment.repository';
import { ShiftService } from './services/shift.service';
import { WeeklyOffService } from './services/weekly-off.service';
import { AttendanceRuleService } from './services/attendance-rule.service';
import { RuleAssignmentService } from './services/rule-assignment.service';
import { GeoValidationService } from './services/geo-validation.service';
import { ShiftController } from './controllers/shift.controller';
import { WeeklyOffController } from './controllers/weekly-off.controller';
import { AttendanceRuleController } from './controllers/attendance-rule.controller';
import { RuleAssignmentController } from './controllers/rule-assignment.controller';
import { GeoValidationController } from './controllers/geo-validation.controller';
import { RbacModule } from '../rbac/rbac.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Shift,
      WeeklyOff,
      AttendanceRule,
      GeoFence,
      RuleAssignment,
    ]),
    RbacModule,
  ],
  controllers: [
    ShiftController,
    WeeklyOffController,
    AttendanceRuleController,
    RuleAssignmentController,
    GeoValidationController,
  ],
  providers: [
    ShiftService,
    WeeklyOffService,
    AttendanceRuleService,
    RuleAssignmentService,
    GeoValidationService,
    ShiftRepository,
    WeeklyOffRepository,
    AttendanceRuleRepository,
    RuleAssignmentRepository,
  ],
  exports: [
    ShiftService,
    WeeklyOffService,
    AttendanceRuleService,
    RuleAssignmentService,
    GeoValidationService,
  ],
})
export class AttendanceModule {}
