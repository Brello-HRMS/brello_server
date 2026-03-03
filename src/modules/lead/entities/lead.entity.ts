import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { LeadStatus } from '../enums/lead-status.enum';
import { LeadSource } from '../enums/lead-source.enum';

@Entity('leads')
export class Lead extends BaseEntity {
  @Column({ type: 'varchar', length: 255, unique: true })
  @Index({ unique: true })
  email: string;

  @Column({ type: 'varchar', length: 100 })
  first_name: string;

  @Column({ type: 'varchar', length: 100 })
  last_name: string;

  @Column({ type: 'varchar', length: 20 })
  phone: string;

  @Column({ type: 'varchar', length: 255 })
  password_hash: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  location: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  device: string;

  @Column({
    type: 'enum',
    enum: LeadSource,
  })
  source: LeadSource;

  @Column({
    type: 'enum',
    enum: LeadStatus,
    default: LeadStatus.NEW,
  })
  lead_status: LeadStatus;

  @Column({ type: 'boolean', default: false })
  is_verified: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  verification_token: string;

  @Column({ type: 'uuid', nullable: true })
  plan_id: string;
}
