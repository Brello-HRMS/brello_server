import { Entity, Column, Index, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { ReimbursementStatus } from '../enums/reimbursement.enum';
import { ReimbursementAttachment } from './reimbursement-attachment.entity';

@Entity('reimbursement')
@Index('idx_reimbursement_tenant', ['enterprise_id', 'organization_id'], {
  where: 'deleted_at IS NULL',
})
@Index('idx_reimbursement_employee', ['employee_id'], { where: 'deleted_at IS NULL' })
@Index('idx_reimbursement_status', ['reimb_status'])
@Index('idx_reimbursement_is_paid', ['is_paid'])
export class Reimbursement extends BaseEntity {
  @Column({ type: 'uuid' })
  employee_id: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  expense_description: string;

  @Column({ type: 'date' })
  expense_date: Date;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({ type: 'varchar', length: 10, default: 'INR' })
  currency: string;

  @Column({
    type: 'enum',
    enum: ReimbursementStatus,
    default: ReimbursementStatus.PENDING,
    name: 'reimb_status',
  })
  reimb_status: ReimbursementStatus;

  @Column({ type: 'text', nullable: true })
  rejection_reason: string | null;

  @Column({ type: 'uuid', nullable: true })
  approved_by: string;

  @Column({ type: 'timestamp', nullable: true })
  approved_at: Date;

  @Column({ type: 'boolean', default: false })
  is_paid: boolean;

  @Column({ type: 'timestamp', nullable: true })
  paid_at: Date;

  @Column({ type: 'uuid', nullable: true })
  processed_in_payroll_id: string;

  @Column({ type: 'uuid' })
  created_by: string;

  @Column({ type: 'integer', default: 1 })
  version: number;

  @OneToMany(() => ReimbursementAttachment, (a) => a.reimbursement, { cascade: true })
  attachments: ReimbursementAttachment[];
}
