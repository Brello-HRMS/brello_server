import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

export enum BillingCycle {
  MONTHLY = 'Monthly',
  ANNUAL = 'Annual',
}

@Entity('plan')
export class Plan extends BaseEntity {
  @Column({ type: 'varchar', length: 100 })
  name: string;

  // Per-employee monthly price in rupees. Historical name kept for back-compat.
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  price: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  price_per_employee_annual: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  annual_discount_percent: number;

  // 0=Free, 1=Standard, 2=Premium — used to detect upgrade vs downgrade.
  @Column({ type: 'int', default: 0 })
  tier_rank: number;

  @Column({
    type: 'enum',
    enum: BillingCycle,
    default: BillingCycle.MONTHLY,
  })
  billing_cycle_default: BillingCycle;

  @Column({ type: 'text', nullable: true })
  declare description: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  discount: number;

  @Column({ type: 'varchar', array: true, default: [] })
  feature: string[];
}
