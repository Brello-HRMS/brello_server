import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { RuleAssignmentRepository } from '../repositories/rule-assignment.repository';
import { AttendanceRuleRepository } from '../repositories/attendance-rule.repository';
import { AssignDepartmentsDto } from '../dto/assign-departments.dto';
import { AssignEmployeesDto } from '../dto/assign-employees.dto';
import { RuleAssignment } from '../entities/rule-assignment.entity';
import { AssignmentType } from '../enums/assignment-type.enum';
import { LoggedInUser } from '../../auth/interfaces/logged-in-user.interface';
import { EmployeeService } from 'src/modules/user/services/employee.service';

@Injectable()
export class RuleAssignmentService {
  private readonly logger = new Logger(RuleAssignmentService.name);

  constructor(
    private readonly assignmentRepo: RuleAssignmentRepository,
    private readonly ruleRepo: AttendanceRuleRepository,
    private readonly userService: EmployeeService,
  ) {}

  async assignToDepartments(
    user: LoggedInUser,
    ruleId: string,
    dto: AssignDepartmentsDto,
  ): Promise<void> {
    await this.validateRuleExists(user, ruleId);

    for (const departmentId of dto.department_ids) {
      // Soft-delete any existing department-level assignment for this target
      await this.assignmentRepo.softDeleteByTarget(
        user.organizationId,
        AssignmentType.DEPARTMENT,
        departmentId,
        user.userId,
      );

      await this.assignmentRepo.create({
        rule_id: ruleId,
        assignment_type: AssignmentType.DEPARTMENT,
        target_id: departmentId,
        organization_id: user.organizationId,
        enterprise_id: user.enterpriseId,
        modified_by: user.userId,
      });
    }

    this.logger.log(
      `Rule ${ruleId} assigned to ${dto.department_ids.length} departments by ${user.userId}`,
    );
  }

  async assignToEmployees(
    user: LoggedInUser,
    ruleId: string,
    dto: AssignEmployeesDto,
  ): Promise<void> {
    await this.validateRuleExists(user, ruleId);

    for (const employeeId of dto.employee_ids) {
      // Soft-delete any existing employee-level assignment for this target
      await this.assignmentRepo.softDeleteByTarget(
        user.organizationId,
        AssignmentType.EMPLOYEE,
        employeeId,
        user.userId,
      );

      await this.assignmentRepo.create({
        rule_id: ruleId,
        assignment_type: AssignmentType.EMPLOYEE,
        target_id: employeeId,
        organization_id: user.organizationId,
        enterprise_id: user.enterpriseId,
        modified_by: user.userId,
      });
    }

    this.logger.log(
      `Rule ${ruleId} assigned to ${dto.employee_ids.length} employees by ${user.userId}`,
    );
  }

  async getAssignments(
    user: LoggedInUser,
    ruleId: string,
  ): Promise<RuleAssignment[]> {
    await this.validateRuleExists(user, ruleId);
    return this.assignmentRepo.findByRule(ruleId, user.organizationId);
  }

  private async validateRuleExists(
    user: LoggedInUser,
    ruleId: string,
  ): Promise<void> {
    const rule = await this.ruleRepo.findOneByOrg(ruleId, user.organizationId);
    if (!rule) {
      throw new NotFoundException(`Attendance rule ${ruleId} not found`);
    }
  }

  async getRuleByEmployeeId(employeeId: string) {
    const employeeRule = await this.assignmentRepo.findByEmployeeId(employeeId);
    let departmentRule;
    if (!employeeRule) {
      const user = await this.userService.getUserById(employeeId);
      departmentRule = await this.assignmentRepo.findRuleByDepartmentId(
        user.department_id,
      );
    }
    if (!departmentRule) {
      throw new NotFoundException(
        `Attendance rule not found for employee ${employeeId}`,
      );
    }
    return departmentRule;
  }
}
