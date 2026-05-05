import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RuleAssignment } from '../entities/rule-assignment.entity';
import { AssignmentType } from '../enums/assignment-type.enum';

@Injectable()
export class RuleAssignmentRepository {
  constructor(
    @InjectRepository(RuleAssignment)
    private readonly repository: Repository<RuleAssignment>,
  ) {}

  async create(data: Partial<RuleAssignment>): Promise<RuleAssignment> {
    const assignment = this.repository.create(data);
    return this.repository.save(assignment);
  }

  async findByRule(
    ruleId: string,
    organizationId: string,
  ): Promise<RuleAssignment[]> {
    return this.repository.find({
      where: {
        rule_id: ruleId,
        organization_id: organizationId,
        is_deleted: false,
      },
      order: { assignment_type: 'ASC', created_at: 'DESC' },
    });
  }

  async findActiveByTarget(
    organizationId: string,
    assignmentType: AssignmentType,
    targetId: string,
  ): Promise<RuleAssignment | null> {
    return this.repository.findOne({
      where: {
        organization_id: organizationId,
        assignment_type: assignmentType,
        target_id: targetId,
        is_deleted: false,
      },
      relations: ['rule'],
    });
  }

  async softDeleteByTarget(
    organizationId: string,
    assignmentType: AssignmentType,
    targetId: string,
    deletedBy?: string,
  ): Promise<void> {
    await this.repository.update(
      {
        organization_id: organizationId,
        assignment_type: assignmentType,
        target_id: targetId,
        is_deleted: false,
      },
      {
        is_deleted: true,
        deleted_at: new Date(),
        deleted_by: deletedBy,
      },
    );
  }

  async findEffectiveRuleForEmployee(
    organizationId: string,
    employeeId: string,
    departmentId?: string,
  ): Promise<RuleAssignment | null> {
    // Employee-level assignment takes precedence
    const employeeAssignment = await this.findActiveByTarget(
      organizationId,
      AssignmentType.EMPLOYEE,
      employeeId,
    );
    if (employeeAssignment) {
      return employeeAssignment;
    }

    // Fall back to department-level assignment
    if (departmentId) {
      return this.findActiveByTarget(
        organizationId,
        AssignmentType.DEPARTMENT,
        departmentId,
      );
    }

    return null;
  }

  async findByEmployeeId(employeeId: string) {
    return this.repository.findOne({
      where: {
        target_id: employeeId,
        is_deleted: false,
        assignment_type: AssignmentType.EMPLOYEE,
      },
    });
  }

  async findRuleByDepartmentId(departmentId: string) {
    return this.repository.findOne({
      where: {
        target_id: departmentId,
        is_deleted: false,
        assignment_type: AssignmentType.DEPARTMENT,
      },
    });
  }
}
