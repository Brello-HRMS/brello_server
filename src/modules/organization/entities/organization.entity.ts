import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Enterprise } from '../../enterprise/entities/enterprise.entity';
import { BaseEntity } from '../../../common/entities/base.entity';

@Entity('organizations')
export class Organization extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  name: string;

  @ManyToOne(() => Enterprise, { eager: false })
  @JoinColumn({ name: 'enterprise_id' })
  enterprise: Enterprise;
}
