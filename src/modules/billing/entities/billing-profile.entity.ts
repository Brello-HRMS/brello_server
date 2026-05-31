import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

@Entity('billing_profile')
@Index(['organization_id'], { unique: true })
export class BillingProfile extends BaseEntity {
  @Column({ type: 'varchar', length: 255, nullable: true })
  legal_business_name: string | null;

  @Column({ type: 'varchar', length: 15, nullable: true })
  gst_number: string | null;

  @Column({ type: 'text', nullable: true })
  billing_address: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  state: string | null;

  @Column({ type: 'varchar', length: 100, default: 'India' })
  country: string;

  @Column({ type: 'varchar', length: 6, nullable: true })
  pincode: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  billing_email: string | null;
}
