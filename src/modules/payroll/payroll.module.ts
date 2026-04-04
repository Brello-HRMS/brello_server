import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PayrollSetting } from './entities/payroll-setting.entity';
import { PayrollComponent } from './entities/payroll-component.entity';
import { PfConfig } from './entities/pf-config.entity';
import { SalaryTemplate } from './entities/salary-template.entity';
import { SalaryTemplateComponent } from './entities/salary-template-component.entity';
import { EmployeeSalary } from './entities/employee-salary.entity';

import { PayrollService } from './services/payroll.service';
import { ComponentMasterService } from './services/component-master.service';
import { PfConfigService } from './services/pf-config.service';
import { SalaryTemplateEngine } from './services/salary-template.service';
import { EmployeeSalaryEngine } from './services/employee-salary.service';
import { PayrollCalculationEngine } from './services/payroll-calculation.service';
import { DryRunEngine } from './services/dry-run.service';
import { PayrollReminderCron } from './services/payroll-reminder.cron';
import { PayrollController } from './controllers/payroll.controller';

import { EmployeeSalaryRepository } from './repositories/employee-salary.repository';

import { User } from '../user/entities/user.entity';
import { UserProfile } from '../user/entities/user-profile.entity';
import { Department } from '../departments/entities/department.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PayrollSetting,
      PayrollComponent,
      PfConfig,
      SalaryTemplate,
      SalaryTemplateComponent,
      EmployeeSalary,
      User,
      UserProfile,
      Department,
    ]),
  ],
  controllers: [PayrollController],
  providers: [
    EmployeeSalaryRepository,
    PayrollService,
    ComponentMasterService,
    PfConfigService,
    SalaryTemplateEngine,
    EmployeeSalaryEngine,
    PayrollCalculationEngine,
    DryRunEngine,
    PayrollReminderCron,
  ],
  exports: [
    PayrollService,
    EmployeeSalaryEngine,
    PayrollCalculationEngine,
    EmployeeSalaryRepository,
  ],
})
export class PayrollModule {}
