import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

@Entity('plan_module')
@Index(['plan_id', 'module_id'], { unique: true })
export class PlanModule extends BaseEntity {
  @Column({ type: 'uuid' })
  plan_id: string;

  @Column({ type: 'uuid' })
  module_id: string;

  @Column({ type: 'boolean', default: true })
  enabled: boolean;
}
