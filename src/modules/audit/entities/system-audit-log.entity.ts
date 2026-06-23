import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { AuditLogModule } from '../enums/audit-log-module.enum';
import { AuditAction } from '../enums/audit-action.enum';

@Entity('system_audit_logs')
@Index('idx_sal_org_time', ['organization_id', 'created_at'])
@Index('idx_sal_org_module_time', ['organization_id', 'module', 'created_at'])
@Index('idx_sal_org_actor_time', ['organization_id', 'actor_id', 'created_at'])
@Index('idx_sal_entity', ['organization_id', 'entity_type', 'entity_id', 'created_at'])
@Index('idx_sal_org_action', ['organization_id', 'action', 'created_at'])
@Index('idx_sal_enterprise_time', ['enterprise_id', 'created_at'])
export class SystemAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  enterprise_id: string;

  @Column({ type: 'uuid', nullable: true })
  organization_id: string | null;

  @Column({ type: 'uuid' })
  actor_id: string;

  @Column({ type: 'varchar', length: 300 })
  actor_name: string;

  @Column({ type: 'varchar', length: 255 })
  actor_email: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  actor_role_label: string | null;

  @Column({ type: 'boolean', default: false })
  is_platform_admin: boolean;

  @Column({ type: 'enum', enum: AuditLogModule })
  module: AuditLogModule;

  @Column({ type: 'varchar', length: 100, nullable: true })
  sub_module: string | null;

  @Column({ type: 'enum', enum: AuditAction })
  action: AuditAction;

  @Column({ type: 'varchar', length: 100 })
  entity_type: string;

  @Column({ type: 'uuid' })
  entity_id: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  entity_display_name: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'jsonb', nullable: true })
  old_value: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  new_value: Record<string, unknown> | null;

  @Column({ type: 'text', array: true, nullable: true })
  changed_fields: string[] | null;

  @Column({ type: 'varchar', length: 45, nullable: true })
  ip_address: string | null;

  @Column({ type: 'text', nullable: true })
  user_agent: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  device: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  request_id: string | null;

  // No updated_at — append-only, immutable
  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
