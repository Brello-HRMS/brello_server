import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Plan } from './plan.entity';

export enum SubscriptionStatus {
  ACTIVE = 'Active',
  EXPIRED = 'Expired',
  CANCELLED = 'Cancelled',
}

@Entity('organization_subscription')
@Index(['organization_id', 'status'])
@Index(['organization_id', 'plan_id'])
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
  status: SubscriptionStatus;

  @Column({ type: 'timestamp' })
  start_date: Date;

  @Column({ type: 'timestamp', nullable: true })
  end_date: Date;
}
