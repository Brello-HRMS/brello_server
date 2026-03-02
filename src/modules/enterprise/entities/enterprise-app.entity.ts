import { BaseEntity } from 'src/common/entities/base.entity';
import { Entity, Column, Index } from 'typeorm';

@Entity('enterprise_app')
@Index(['enterprise_id', 'app_id'], { unique: true })
export class EnterpriseApp extends BaseEntity {
  @Column({ type: 'uuid' })
  declare enterprise_id: string;

  @Column({ type: 'uuid' })
  app_id: string;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;
}
