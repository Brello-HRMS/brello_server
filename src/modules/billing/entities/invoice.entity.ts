import { Entity, Column, Index, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { OrganizationSubscription } from '../../plan/entities/organization-subscription.entity';
import { BillingCycle } from '../../plan/entities/plan.entity';
import { InvoiceLineItem } from './invoice-line-item.entity';

export enum InvoiceStatus {
  PENDING = 'Pending',
  PAID = 'Paid',
  FAILED = 'Failed',
  OVERDUE = 'Overdue',
  CANCELLED = 'Cancelled',
}

@Entity('invoice')
@Index(['invoice_number'], { unique: true })
@Index(['organization_id', 'invoice_status'])
@Index(['organization_id', 'invoice_date'])
export class Invoice extends BaseEntity {
  @Column({ type: 'varchar', length: 50, unique: true })
  invoice_number: string;

  @Column({ type: 'uuid' })
  subscription_id: string;

  @ManyToOne(() => OrganizationSubscription, { eager: false })
  @JoinColumn({ name: 'subscription_id' })
  subscription: OrganizationSubscription;

  @Column({ type: 'uuid' })
  plan_id_snapshot: string;

  @Column({ type: 'varchar', length: 100 })
  plan_name_snapshot: string;

  @Column({
    type: 'enum',
    enum: BillingCycle,
  })
  billing_cycle: BillingCycle;

  @Column({ type: 'jsonb', nullable: true })
  billing_profile_snapshot: Record<string, unknown> | null;

  @Column({ type: 'date' })
  billing_period_start: Date;

  @Column({ type: 'date' })
  billing_period_end: Date;

  @Column({ type: 'timestamp' })
  invoice_date: Date;

  @Column({ type: 'timestamp' })
  due_date: Date;

  @Column({ type: 'int' })
  employee_count_snapshot: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  price_per_employee: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  subtotal: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 18 })
  gst_rate: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  gst_amount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  total: number;

  @Column({
    type: 'enum',
    enum: InvoiceStatus,
    default: InvoiceStatus.PENDING,
  })
  invoice_status: InvoiceStatus;

  @Column({ type: 'timestamp', nullable: true })
  paid_at: Date | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  pdf_s3_key: string | null;

  @OneToMany(() => InvoiceLineItem, (li) => li.invoice, {
    cascade: true,
  })
  line_items: InvoiceLineItem[];
}
