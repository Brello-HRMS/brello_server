import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { User } from '../../user/entities/user.entity';
import { PayrollItemStatus, PayoutStatus } from '../enums/payroll.enum';
import { PayrollRun } from './payroll-run.entity';

/**
 * Per-employee payroll result within a run — effectively the frozen payslip data.
 * Holds the attendance snapshot used for LWP, the calculation breakdown, and the
 * salary structure version that was applied.
 */
@Entity('payroll_run_items')
@Index(['payroll_run_id', 'user_id'], { unique: true })
@Index(['payroll_run_id', 'item_status'])
export class PayrollRunItem extends BaseEntity {
  @Column({ type: 'uuid' })
  payroll_run_id: string;

  @ManyToOne(() => PayrollRun, (run) => run.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'payroll_run_id' })
  payroll_run: PayrollRun;

  @Column({ type: 'uuid' })
  user_id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  // ─── Attendance snapshot (drives LWP) ────────────────────────────────────────

  @Column({ type: 'int', default: 0 })
  total_working_days: number;

  @Column({ type: 'decimal', precision: 6, scale: 2, default: 0 })
  present_days: number;

  @Column({ type: 'decimal', precision: 6, scale: 2, default: 0 })
  paid_leave_days: number;

  @Column({ type: 'decimal', precision: 6, scale: 2, default: 0 })
  lop_days: number;

  // ─── Calculation result ──────────────────────────────────────────────────────

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  gross: number;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  deductions_total: number;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  net: number;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  employer_contribution: number;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  reimbursement_total: number;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  bonus_total: number;

  @Column({
    type: 'enum',
    enum: PayrollItemStatus,
    default: PayrollItemStatus.PENDING,
  })
  item_status: PayrollItemStatus;

  @Column({ type: 'text', nullable: true })
  error_message: string | null;

  // ─── Frozen snapshots (jsonb) ────────────────────────────────────────────────

  /** The EmployeeSalary version + components used for this run. */
  @Column({ type: 'jsonb', nullable: true })
  salary_snapshot: Record<string, any> | null;

  /** Engine output: earnings[] and deductions[] line items. */
  @Column({ type: 'jsonb', nullable: true })
  calc_breakdown: Record<string, any> | null;

  /** S3 object key of the generated payslip PDF (set at lock). */
  @Column({ type: 'varchar', length: 512, nullable: true })
  payslip_pdf_key: string | null;

  // ─── Disbursement (post-lock payout tracking) ────────────────────────────────

  @Column({
    type: 'enum',
    enum: PayoutStatus,
    default: PayoutStatus.PENDING,
  })
  payout_status: PayoutStatus;

  @Column({ type: 'timestamp', nullable: true })
  paid_at: Date | null;
}
