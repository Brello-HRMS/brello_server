import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../../../common/entities/base.entity';

@Entity('letter_categories')
@Index(['organization_id', 'status'])
@Index(['organization_id', 'name'], { unique: true })
export class LetterCategory extends BaseEntity {
  @Column({ type: 'varchar', length: 100 })
  name: string;
}
