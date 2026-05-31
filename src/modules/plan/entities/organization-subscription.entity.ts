import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Plan, BillingCycle } from './plan.entity';

export enum SubscriptionStatus {
  TRIAL = 'Trial',
  ACTIVE = 'Active',
  GRACE = 'Grace',
  EXPIRED = 'Expired',
  CANCELLED = 'Cancelled',
}

@Entity('organization_subscription')
@Index(['organization_id', 'status'])
@Index(['organization_id', 'sub_status'])
@Index(['organization_id', 'plan_id'])
@Index(['next_renewal_date'])
export class OrganizationSubscription extends BaseEntity {
  @Column({ type: 'uuid' })
  declare organization_id: string;

  @Column({ type: 'uuid' })
  plan_id: string;

  @ManyToOne(() => Plan, { eager: false })
  @JoinColumn({ name: 'plan_id' })
  plan: Plan;

  @Column({
    type: 'enum',
    enum: SubscriptionStatus,
    default: SubscriptionStatus.ACTIVE,
  })
  sub_status: SubscriptionStatus;

  @Column({
    type: 'enum',
    enum: BillingCycle,
    default: BillingCycle.MONTHLY,
  })
  billing_cycle: BillingCycle;

  @Column({ type: 'boolean', default: false })
  is_trial: boolean;

  @Column({ type: 'timestamp' })
  start_date: Date;

  @Column({ type: 'timestamp', nullable: true })
  end_date: Date;

  @Column({ type: 'timestamp', nullable: true })
  next_renewal_date: Date;

  // Deferred plan change applied at next renewal.
  @Column({ type: 'uuid', nullable: true })
  pending_plan_id: string | null;

  @Column({
    type: 'enum',
    enum: BillingCycle,
    nullable: true,
  })
  pending_billing_cycle: BillingCycle | null;

  // Set when sub_status flips to GRACE; past this timestamp the sub becomes EXPIRED (blocking).
  @Column({ type: 'timestamp', nullable: true })
  grace_period_ends_at: Date | null;
}
