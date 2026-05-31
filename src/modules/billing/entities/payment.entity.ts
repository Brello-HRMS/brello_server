import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Invoice } from './invoice.entity';

export enum PaymentStatus {
  INITIATED = 'Initiated',
  PROCESSING = 'Processing',
  SUCCESS = 'Success',
  FAILED = 'Failed',
}

@Entity('payment')
@Index(['invoice_id'])
@Index(['razorpay_order_id'])
@Index(['razorpay_payment_id'], { unique: true, where: 'razorpay_payment_id IS NOT NULL' })
export class Payment extends BaseEntity {
  @Column({ type: 'uuid' })
  invoice_id: string;

  @ManyToOne(() => Invoice, { eager: false })
  @JoinColumn({ name: 'invoice_id' })
  invoice: Invoice;

  @Column({ type: 'varchar', length: 100 })
  razorpay_order_id: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  razorpay_payment_id: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  razorpay_signature: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({ type: 'varchar', length: 10, default: 'INR' })
  currency: string;

  @Column({
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.INITIATED,
  })
  payment_status: PaymentStatus;

  @Column({ type: 'text', nullable: true })
  failure_reason: string | null;

  @Column({ type: 'timestamp', nullable: true })
  paid_at: Date | null;

  @Column({ type: 'jsonb', nullable: true })
  raw_webhook_payload: Record<string, unknown> | null;
}
