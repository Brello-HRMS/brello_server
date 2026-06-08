import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { AdjustmentType } from '../enums/payroll.enum';
import { PayrollRun } from './payroll-run.entity';

/**
 * A manual bonus or deduction applied to one employee within a payroll run.
 * Summed into the calculation at process/reprocess time. Editable only while the
 * run is unlocked.
 */
@Entity('payroll_run_adjustments')
@Index(['payroll_run_id', 'user_id'])
export class PayrollRunAdjustment extends BaseEntity {
  @Column({ type: 'uuid' })
  payroll_run_id: string;

  @ManyToOne(() => PayrollRun, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'payroll_run_id' })
  payroll_run: PayrollRun;

  @Column({ type: 'uuid' })
  user_id: string;

  @Column({ type: 'enum', enum: AdjustmentType })
  adjustment_type: AdjustmentType;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @Column({ type: 'uuid' })
  created_by: string;
}
