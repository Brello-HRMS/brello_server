import { Entity, Column, OneToMany, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { FinancialMonth, PayrollRunStatus } from '../enums/payroll.enum';
import { PayrollRunItem } from './payroll-run-item.entity';

/**
 * A single monthly payroll cycle for an organization.
 * One row per (organization, month, year). Drives the Draft → Processing →
 * Completed → Locked lifecycle. Snapshot totals are rolled up at process time.
 */
@Entity('payroll_runs')
@Index(['organization_id', 'year', 'month'], { unique: true })
@Index(['organization_id', 'status'])
export class PayrollRun extends BaseEntity {
  @Column({ type: 'enum', enum: FinancialMonth })
  month: FinancialMonth;

  @Column({ type: 'int' })
  year: number;

  @Column({
    type: 'enum',
    enum: PayrollRunStatus,
    default: PayrollRunStatus.DRAFT,
  })
  run_status: PayrollRunStatus;

  @Column({ type: 'date' })
  pay_period_from: Date;

  @Column({ type: 'date' })
  pay_period_to: Date;

  @Column({ type: 'int', default: 0 })
  total_working_days: number;

  // ─── Rolled-up snapshot totals (set during process) ──────────────────────────

  @Column({ type: 'int', default: 0 })
  total_employees: number;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  total_gross: number;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  total_deductions: number;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  total_net: number;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  total_employer_contribution: number;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  total_reimbursement: number;

  // ─── Lifecycle stamps ────────────────────────────────────────────────────────

  @Column({ type: 'timestamp', nullable: true })
  processed_at: Date;

  @Column({ type: 'uuid', nullable: true })
  processed_by: string;

  @Column({ type: 'timestamp', nullable: true })
  locked_at: Date;

  @Column({ type: 'uuid', nullable: true })
  locked_by: string;

  // ─── Disbursement (post-lock payout tracking) ────────────────────────────────

  @Column({ type: 'boolean', default: false })
  is_disbursed: boolean;

  @Column({ type: 'timestamp', nullable: true })
  disbursed_at: Date | null;

  @Column({ type: 'uuid', nullable: true })
  disbursed_by: string | null;

  /** Free-text payout reference (NEFT/UTR batch, bank file id, etc.). */
  @Column({ type: 'varchar', length: 255, nullable: true })
  disbursement_reference: string | null;

  @OneToMany(() => PayrollRunItem, (item) => item.payroll_run, { cascade: false })
  items: PayrollRunItem[];
}
