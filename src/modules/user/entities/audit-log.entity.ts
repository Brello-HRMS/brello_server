import { Entity, Column, Index, CreateDateColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

@Entity('audit_log')
export class AuditLog extends BaseEntity {
  @Column({ type: 'uuid' })
  @Index()
  actor_id: string;

  @Column({ type: 'varchar', length: 100 })
  action: string;

  @Column({ type: 'jsonb', nullable: true })
  old_value: any;

  @Column({ type: 'jsonb', nullable: true })
  new_value: any;

  @Column({ type: 'uuid', nullable: true })
  target_id: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  target_type: string;
}
