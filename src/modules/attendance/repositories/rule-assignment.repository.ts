import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RuleAssignment } from '../entities/rule-assignment.entity';
import { AssignmentType } from '../enums/assignment-type.enum';

interface BulkAssignContext {
  organizationId: string;
  enterpriseId: string;
  userId: string;
}

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

  async findEffectiveRuleForEmployee(
    organizationId: string,
    employeeId: string,
    departmentId?: string,
  ): Promise<RuleAssignment | null> {
    const emp = await this.findActiveByTarget(
      organizationId,
      AssignmentType.EMPLOYEE,
      employeeId,
    );
    if (emp) return emp;
    if (departmentId)
      return this.findActiveByTarget(
        organizationId,
        AssignmentType.DEPARTMENT,
        departmentId,
      );
    return null;
  }

  /**
   * Atomically replaces all assignments for the given targets in one transaction.
   * Drops N*2 round-trips (loop of softDelete + create) to 2 queries total.
   */
  async bulkAssign(
    ruleId: string,
    assignmentType: AssignmentType,
    targetIds: string[],
    ctx: BulkAssignContext,
  ): Promise<void> {
    if (targetIds.length === 0) return;

    await this.repository.manager.transaction(async (manager) => {
      await manager
        .createQueryBuilder()
        .update(RuleAssignment)
        .set({
          is_deleted: true,
          deleted_at: new Date(),
          deleted_by: ctx.userId,
        })
        .where('organization_id = :orgId', { orgId: ctx.organizationId })
        .andWhere('assignment_type = :type', { type: assignmentType })
        .andWhere('target_id IN (:...ids)', { ids: targetIds })
        .andWhere('is_deleted = false')
        .execute();

      await manager
        .createQueryBuilder()
        .insert()
        .into(RuleAssignment)
        .values(
          targetIds.map((targetId) => ({
            rule_id: ruleId,
            assignment_type: assignmentType,
            target_id: targetId,
            organization_id: ctx.organizationId,
            enterprise_id: ctx.enterpriseId,
            modified_by: ctx.userId,
          })),
        )
        .execute();
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
      { is_deleted: true, deleted_at: new Date(), deleted_by: deletedBy },
    );
  }
}
