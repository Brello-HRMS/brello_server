import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';
import { AuditAction } from '../enums/payroll.enum';

@Entity('payroll_audit_logs')
export class PayrollAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  enterprise_id: string;

  @Column({ type: 'uuid', nullable: true })
  organization_id: string;

  @Column({ type: 'varchar', length: 100 })
  entity_type: string;

  @Column({ type: 'uuid' })
  entity_id: string;

  @Column({ type: 'enum', enum: AuditAction })
  action: AuditAction;

  @Column({ type: 'jsonb', nullable: true })
  before_data: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  after_data: Record<string, any>;

  @Column({ type: 'uuid' })
  changed_by: string;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;
}
