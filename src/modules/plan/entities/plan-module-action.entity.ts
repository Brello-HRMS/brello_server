import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

@Entity('plan_module_action')
@Index(['plan_id', 'module_id', 'action_id'], { unique: true })
export class PlanModuleAction extends BaseEntity {
  @Column({ type: 'uuid' })
  plan_id: string;

  @Column({ type: 'uuid' })
  module_id: string;

  @Column({ type: 'uuid' })
  action_id: string;

  @Column({ type: 'boolean', default: true })
  enabled: boolean;
}
