import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

@Entity('plan_app')
@Index(['plan_id', 'app_id'], { unique: true })
export class PlanApp extends BaseEntity {
  @Column({ type: 'uuid' })
  plan_id: string;

  @Column({ type: 'uuid' })
  app_id: string;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;
}
