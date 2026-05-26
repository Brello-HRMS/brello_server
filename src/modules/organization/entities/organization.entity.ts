import { Entity, Column, ManyToOne, JoinColumn, OneToOne } from 'typeorm';
import { Enterprise } from '../../enterprise/entities/enterprise.entity';
import { BaseEntity } from '../../../common/entities/base.entity';
import { OrganizationProfile } from './organization-profile.entity';

@Entity('organizations')
export class Organization extends BaseEntity {
  @Column({ type: 'varchar', length: 255, unique: true })
  name: string;

  @Column({ type: 'varchar', length: 255, unique: true, nullable: true })
  website_url: string;

  @Column({ type: 'varchar', length: 255, unique: true, nullable: true })
  subdomain: string;

  @ManyToOne(() => Enterprise, { eager: false })
  @JoinColumn({ name: 'enterprise_id' })
  enterprise: Enterprise;

  @OneToOne(() => OrganizationProfile, (profile) => profile.organization)
  profile: OrganizationProfile;
}
