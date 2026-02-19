import {
    Entity,
    Column,
    ManyToOne,
    JoinColumn,
    Index,
    PrimaryGeneratedColumn,
    CreateDateColumn,
    UpdateDateColumn,
} from 'typeorm';
import { Plan } from './plan.entity';

export enum SubscriptionStatus {
    ACTIVE = 'active',
    EXPIRED = 'expired',
    TRIAL = 'trial',
    CANCELLED = 'cancelled',
}

/**
 * OrganizationSubscription Entity
 *
 * Tracks which plan an organization is currently subscribed to.
 * PermissionResolver fetches the ACTIVE subscription to apply plan restrictions.
 */
@Entity('organization_subscription')
@Index(['organization_id', 'status'])
@Index(['organization_id', 'plan_id'])
export class OrganizationSubscription {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    organization_id: string;

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

    @Column({ type: 'timestamp' })
    end_date: Date;

    @CreateDateColumn({ type: 'timestamp' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamp' })
    updated_at: Date;
}
