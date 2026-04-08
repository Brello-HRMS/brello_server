import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { AssignmentType } from '../enums/assignment-type.enum';
import { AttendanceRule } from './attendance-rule.entity';

@Entity('rule_assignments')
@Index(['organization_id', 'assignment_type', 'target_id'], {
  unique: true,
  where: '"is_deleted" = false',
})
export class RuleAssignment extends BaseEntity {
  @Column({ type: 'uuid' })
  rule_id: string;

  @ManyToOne(() => AttendanceRule, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'rule_id' })
  rule: AttendanceRule;

  @Column({ type: 'enum', enum: AssignmentType })
  assignment_type: AssignmentType;

  /** department_id or user_id depending on assignment_type */
  @Column({ type: 'uuid' })
  target_id: string;

  @Column({ type: 'boolean', default: false })
  is_deleted: boolean;
}
