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
@Index(['razorpay_payment_link_id'])
@Index(['razorpay_payment_id'], { unique: true, where: 'razorpay_payment_id IS NOT NULL' })
export class Payment extends BaseEntity {
  @Column({ type: 'uuid' })
  invoice_id: string;

  @ManyToOne(() => Invoice, { eager: false })
  @JoinColumn({ name: 'invoice_id' })
  invoice: Invoice;

  // Nullable: payment-link payments do not carry an order id we created (the
  // link generates its own order on the Razorpay side).
  @Column({ type: 'varchar', length: 100, nullable: true })
  razorpay_order_id: string | null;

  // Razorpay Payment Link id (plink_xxx) when the backend generated a hosted link.
  @Column({ type: 'varchar', length: 100, nullable: true })
  razorpay_payment_link_id: string | null;

  // Hosted payment page URL returned by the Payment Links API.
  @Column({ type: 'varchar', length: 512, nullable: true })
  short_url: string | null;

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
