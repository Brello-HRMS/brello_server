import { Entity, Column, ManyToOne, JoinColumn, OneToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Organization } from './organization.entity';
import { Enterprise } from '../../enterprise/entities/enterprise.entity';
import { Document } from '../../document/entities/document.entity';
import { IndustryType } from '../../industry-type/entities/industry-type.entity';

@Entity('organization_profile')
export class OrganizationProfile extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 50, unique: true })
  phone: string;

  @Column({ type: 'varchar', length: 50, unique: true, nullable: true })
  gst_no: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  domain: string;

  @Column({ type: 'varchar', length: 100, unique: true, nullable: true })
  registration_no: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  address: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  city: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  state: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  zip_code: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  country: string;

  // Relations
  @Column({ type: 'uuid', nullable: true })
  logo_id: string;

  @ManyToOne(() => Document, { nullable: true })
  @JoinColumn({ name: 'logo_id' })
  logo: Document;

  @Column({ type: 'uuid', nullable: true })
  industry_type_id: string;

  @ManyToOne(() => IndustryType, { nullable: true })
  @JoinColumn({ name: 'industry_type_id' })
  industry_type: IndustryType;

  @OneToOne(() => Organization)
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @ManyToOne(() => Enterprise)
  @JoinColumn({ name: 'enterprise_id' })
  enterprise: Enterprise;

  @Column({ type: 'uuid', nullable: true })
  parent_id: string;

  @ManyToOne(() => Organization, { nullable: true })
  @JoinColumn({ name: 'parent_id' })
  parent: Organization;
}
