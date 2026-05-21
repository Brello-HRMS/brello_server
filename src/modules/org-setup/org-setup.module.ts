import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrgSetupController } from './org-setup.controller';
import { OrgSetupService } from './org-setup.service';

import { Department } from '../departments/entities/department.entity';
import { Designation } from '../designations/entities/designation.entity';
import { CompanyPolicy } from '../company-policy/entities/company-policy.entity';
import { PayrollComponent } from '../payroll/entities/payroll-component.entity';
import { SalaryTemplate } from '../payroll/entities/salary-template.entity';
import { User } from '../user/entities/user.entity';
import { LeaveConfig } from '../leave-config/entities/leave-config.entity';
import { AttendanceRule } from '../attendance/entities/attendance-rule.entity';
import { Organization } from '../organization/entities/organization.entity';
import { OrgSetupCron } from './org-setup.cron';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Department,
      Designation,
      CompanyPolicy,
      PayrollComponent,
      SalaryTemplate,
      LeaveConfig,
      AttendanceRule,
      Organization,
      User,
    ]),
  ],
  controllers: [OrgSetupController],
  providers: [OrgSetupService, OrgSetupCron],
  exports: [OrgSetupService],
})
export class OrgSetupModule {}
