import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';
import { AuditAction } from '../enums/reimbursement.enum';

@Entity('reimbursement_audit_log')
export class ReimbursementAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  reimbursement_id: string;

  @Column({ type: 'enum', enum: AuditAction })
  action: AuditAction;

  @Column({ type: 'jsonb', nullable: true })
  old_data: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  new_data: Record<string, any>;

  @Column({ type: 'uuid' })
  performed_by: string;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;
}
