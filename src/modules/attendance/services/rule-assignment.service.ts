import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { RuleAssignmentRepository } from '../repositories/rule-assignment.repository';
import { AttendanceRuleRepository } from '../repositories/attendance-rule.repository';
import { AssignDepartmentsDto } from '../dto/assign-departments.dto';
import { AssignEmployeesDto } from '../dto/assign-employees.dto';
import { RuleAssignment } from '../entities/rule-assignment.entity';
import { AssignmentType } from '../enums/assignment-type.enum';
import { LoggedInUser } from '../../auth/interfaces/logged-in-user.interface';

@Injectable()
export class RuleAssignmentService {
  private readonly logger = new Logger(RuleAssignmentService.name);

  constructor(
    private readonly assignmentRepo: RuleAssignmentRepository,
    private readonly ruleRepo: AttendanceRuleRepository,
  ) {}

  async assignToDepartments(
    user: LoggedInUser,
    ruleId: string,
    dto: AssignDepartmentsDto,
  ): Promise<void> {
    await this.validateRuleExists(user, ruleId);

    await this.assignmentRepo.bulkAssign(
      ruleId,
      AssignmentType.DEPARTMENT,
      dto.department_ids,
      {
        organizationId: user.organizationId,
        enterpriseId: user.enterpriseId,
        userId: user.userId,
      },
    );

    this.logger.log(
      `[AUDIT] Rule ${ruleId} → ${dto.department_ids.length} departments by ${user.userId}`,
    );
  }

  async assignToEmployees(
    user: LoggedInUser,
    ruleId: string,
    dto: AssignEmployeesDto,
  ): Promise<void> {
    await this.validateRuleExists(user, ruleId);

    await this.assignmentRepo.bulkAssign(
      ruleId,
      AssignmentType.EMPLOYEE,
      dto.employee_ids,
      {
        organizationId: user.organizationId,
        enterpriseId: user.enterpriseId,
        userId: user.userId,
      },
    );

    this.logger.log(
      `[AUDIT] Rule ${ruleId} → ${dto.employee_ids.length} employees by ${user.userId}`,
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
    if (!rule)
      throw new NotFoundException(`Attendance rule ${ruleId} not found`);
  }
}
