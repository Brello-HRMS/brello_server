import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

@Entity('enterprise_app')
@Index(['enterprise_id', 'app_id'], { unique: true })
export class EnterpriseApp extends BaseEntity {
  @Column({ type: 'uuid' })
  declare enterprise_id: string;

  @Column({ type: 'uuid' })
  app_id: string;
}
