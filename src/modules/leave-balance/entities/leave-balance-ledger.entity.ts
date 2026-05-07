import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { LeaveBalance } from './leave-balance.entity';
import { LedgerDirection, LedgerEntryType } from '../enums';

@Entity('leave_balance_ledger')
@Index(['balance_id', 'created_at'])
@Index(['reference_id'])
export class LeaveBalanceLedger extends BaseEntity {
  @Column({ type: 'uuid' })
  balance_id: string;

  @ManyToOne(() => LeaveBalance, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'balance_id' })
  balance: LeaveBalance;

  @Column({ type: 'enum', enum: LedgerEntryType })
  entry_type: LedgerEntryType;

  @Column({ type: 'enum', enum: LedgerDirection })
  direction: LedgerDirection;

  @Column({ type: 'decimal', precision: 6, scale: 2 })
  days: string;

  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true })
  running_balance: string | null;

  @Column({ type: 'uuid', nullable: true })
  reference_id: string | null;

  @Column({ type: 'text', nullable: true })
  reason: string | null;
}
