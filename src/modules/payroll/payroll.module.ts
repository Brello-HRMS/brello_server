import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PayrollSetting } from './entities/payroll-setting.entity';
import { PayrollComponent } from './entities/payroll-component.entity';
import { PfConfig } from './entities/pf-config.entity';
import { SalaryTemplate } from './entities/salary-template.entity';
import { SalaryTemplateComponent } from './entities/salary-template-component.entity';
import { EmployeeSalary } from './entities/employee-salary.entity';
import { EmployeeSalaryComponent } from './entities/employee-salary-component.entity';
import { EmployeeStatutoryOverride } from './entities/employee-statutory-override.entity';
import { PayrollAuditLog } from './entities/payroll-audit-log.entity';
import { PayrollRun } from './entities/payroll-run.entity';
import { PayrollRunItem } from './entities/payroll-run-item.entity';
import { PayrollRunAdjustment } from './entities/payroll-run-adjustment.entity';

import { PayrollService } from './services/payroll.service';
import { ComponentMasterService } from './services/component-master.service';
import { PfConfigService } from './services/pf-config.service';
import { SalaryTemplateEngine } from './services/salary-template.service';
import { EmployeeSalaryEngine } from './services/employee-salary.service';
import { PayrollCalculationEngine } from './services/payroll-calculation.service';
import { DryRunEngine } from './services/dry-run.service';
import { PayrollReminderCron } from './services/payroll-reminder.cron';
import { ChangePropagationService } from './services/change-propagation.service';

import { PayrollController } from './controllers/payroll.controller';
import { PayrollRunController } from './controllers/payroll-run.controller';
import { PayrollPayslipController } from './controllers/payroll-payslip.controller';
import { EmployeeSalaryRepository } from './repositories/employee-salary.repository';
import { PayrollRunRepository } from './repositories/payroll-run.repository';
import { PayrollRunItemRepository } from './repositories/payroll-run-item.repository';
import { PayrollSourceRepository } from './repositories/payroll-source.repository';
import { PayrollAdjustmentRepository } from './repositories/payroll-adjustment.repository';
import { PayrollReimbursementRepository } from './repositories/payroll-reimbursement.repository';
import { PayrollRunService } from './services/payroll-run.service';
import { PayrollPreparationService } from './services/payroll-preparation.service';
import { PayrollProcessingService } from './services/payroll-processing.service';
import { PayrollAdjustmentService } from './services/payroll-adjustment.service';
import { PayslipService } from './services/payslip.service';
import { PayslipPdfService } from './services/payslip-pdf.service';
import { PayrollAuditService } from './services/payroll-audit.service';
import { RbacModule } from '../rbac/rbac.module';
import { DocumentModule } from '../document/document.module';

import { User } from '../user/entities/user.entity';
import { UserProfile } from '../user/entities/user-profile.entity';
import { Department } from '../departments/entities/department.entity';
import { AttendanceRecord } from '../attendance/entities/attendance-record.entity';
import { LeaveRequest } from '../leave-request/entities/leave-request.entity';
import { Reimbursement } from '../reimbursement/entities/reimbursement.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PayrollSetting,
      PayrollComponent,
      PfConfig,
      SalaryTemplate,
      SalaryTemplateComponent,
      EmployeeSalary,
      EmployeeSalaryComponent,
      EmployeeStatutoryOverride,
      PayrollAuditLog,
      PayrollRun,
      PayrollRunItem,
      PayrollRunAdjustment,
      User,
      UserProfile,
      Department,
      AttendanceRecord,
      LeaveRequest,
      Reimbursement,
    ]),
    RbacModule,
    DocumentModule,
  ],
  controllers: [
    PayrollController,
    PayrollRunController,
    PayrollPayslipController,
  ],
  providers: [
    EmployeeSalaryRepository,
    PayrollRunRepository,
    PayrollRunItemRepository,
    PayrollSourceRepository,
    PayrollAdjustmentRepository,
    PayrollReimbursementRepository,
    PayrollAuditService,
    PayrollRunService,
    PayrollPreparationService,
    PayrollProcessingService,
    PayrollAdjustmentService,
    PayslipService,
    PayslipPdfService,
    PayrollService,
    ComponentMasterService,
    PfConfigService,
    SalaryTemplateEngine,
    EmployeeSalaryEngine,
    PayrollCalculationEngine,
    DryRunEngine,
    PayrollReminderCron,
    ChangePropagationService,
  ],
  exports: [
    PayrollService,
    EmployeeSalaryEngine,
    PayrollCalculationEngine,
    EmployeeSalaryRepository,
    ChangePropagationService,
  ],
})
export class PayrollModule {}
