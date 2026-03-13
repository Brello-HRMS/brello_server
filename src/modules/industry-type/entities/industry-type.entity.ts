import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

@Entity('industry_type')
export class IndustryType extends BaseEntity {
  @Column({ type: 'varchar', length: 255, unique: true })
  name: string;
}
