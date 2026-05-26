import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Department } from '../departments/entities/department.entity';
import { Designation } from '../designations/entities/designation.entity';
import { CompanyPolicy } from '../company-policy/entities/company-policy.entity';
import { PayrollComponent } from '../payroll/entities/payroll-component.entity';
import { SalaryTemplate } from '../payroll/entities/salary-template.entity';
import { User } from '../user/entities/user.entity';
import { LeaveConfig } from '../leave-config/entities/leave-config.entity';
import { AttendanceRule } from '../attendance/entities/attendance-rule.entity';

export interface SetupStatusResponse {
  totalSteps: number;
  completedSteps: number;
  completionPercentage: number;
  steps: {
    DEPARTMENTS: boolean;
    DESIGNATIONS: boolean;
    COMPANY_POLICIES: boolean;
    PAYROLL: boolean;
    LEAVE: boolean;
    ATTENDANCE: boolean;
    EMPLOYEES: boolean;
  };
}

@Injectable()
export class OrgSetupService {
  constructor(
    @InjectRepository(Department)
    private departmentRepo: Repository<Department>,
    @InjectRepository(Designation)
    private designationRepo: Repository<Designation>,
    @InjectRepository(CompanyPolicy)
    private companyPolicyRepo: Repository<CompanyPolicy>,
    @InjectRepository(PayrollComponent)
    private payrollComponentRepo: Repository<PayrollComponent>,
    @InjectRepository(SalaryTemplate)
    private salaryTemplateRepo: Repository<SalaryTemplate>,
    @InjectRepository(LeaveConfig)
    private leaveConfigRepo: Repository<LeaveConfig>,
    @InjectRepository(AttendanceRule)
    private attendanceRuleRepo: Repository<AttendanceRule>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
  ) {}

  async getSetupStatus(orgId: string): Promise<SetupStatusResponse> {
    const [
      departmentsCount,
      designationsCount,
      companyPoliciesCount,
      payrollComponentCount,
      salaryTemplateCount,
      leaveConfigCount,
      attendanceRuleCount,
      employeesCount,
    ] = await Promise.all([
      this.departmentRepo.count({ where: { organization_id: orgId, is_deleted: false } }),
      this.designationRepo.count({ where: { org_id: orgId, is_deleted: false } }),
      this.companyPolicyRepo.count({ where: { organization_id: orgId, is_deleted: false } }),
      this.payrollComponentRepo.count({ where: { organization_id: orgId, is_active: true } }),
      this.salaryTemplateRepo.count({ where: { organization_id: orgId, is_active: true } }),
      this.leaveConfigRepo.count({ where: { organization_id: orgId } }),
      this.attendanceRuleRepo.count({ where: { organization_id: orgId } }),
      this.userRepo.count({ where: { organization_id: orgId } }),
    ]);

    const steps = {
      DEPARTMENTS: departmentsCount > 0,
      DESIGNATIONS: designationsCount > 0,
      COMPANY_POLICIES: companyPoliciesCount > 0,
      PAYROLL: payrollComponentCount > 0 && salaryTemplateCount > 0,
      LEAVE: leaveConfigCount > 0,
      ATTENDANCE: attendanceRuleCount > 0,
      EMPLOYEES: employeesCount > 1, // > 1 because the admin themselves is 1
    };

    const totalSteps = 7;
    const completedSteps = Object.values(steps).filter(Boolean).length;
    const completionPercentage = (completedSteps / totalSteps) * 100;

    return {
      totalSteps,
      completedSteps,
      completionPercentage,
      steps,
    };
  }
}
