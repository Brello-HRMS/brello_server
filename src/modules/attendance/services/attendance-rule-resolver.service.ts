import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { AttendanceRule } from '../entities/attendance-rule.entity';
import { GeoFence } from '../entities/geo-fence.entity';
import { Shift } from '../entities/shift.entity';
import { RuleAssignmentRepository } from '../repositories/rule-assignment.repository';

export interface ResolvedRule {
  rule: AttendanceRule;
  shift: Shift;
  geoFence: GeoFence | null;
}

@Injectable()
export class AttendanceRuleResolverService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(AttendanceRule)
    private readonly ruleRepo: Repository<AttendanceRule>,
    @InjectRepository(GeoFence)
    private readonly geoFenceRepo: Repository<GeoFence>,
    @InjectRepository(Shift)
    private readonly shiftRepo: Repository<Shift>,
    private readonly assignmentRepo: RuleAssignmentRepository,
  ) {}

  async resolveForEmployee(
    organizationId: string,
    employeeId: string,
  ): Promise<ResolvedRule> {
    const employee = await this.userRepo.findOne({
      where: { id: employeeId, organization_id: organizationId },
      select: ['id', 'department_id'],
    });
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    const assignment = await this.assignmentRepo.findEffectiveRuleForEmployee(
      organizationId,
      employeeId,
      employee.department_id ?? undefined,
    );

    if (!assignment) {
      throw new NotFoundException(
        'No attendance rule assigned to this employee or their department',
      );
    }

    const rule = await this.ruleRepo.findOne({
      where: { id: assignment.rule_id, is_deleted: false },
    });
    if (!rule) {
      throw new NotFoundException('Assigned attendance rule not found');
    }

    const shift = await this.shiftRepo.findOne({
      where: { id: rule.shift_id, is_deleted: false },
    });
    if (!shift) {
      throw new NotFoundException(
        'Shift configured on attendance rule not found',
      );
    }

    const geoFence = rule.require_geo_fencing
      ? await this.geoFenceRepo.findOne({
          where: { rule_id: rule.id, is_deleted: false },
        })
      : null;

    return { rule, shift, geoFence };
  }
}
