import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

@Entity('letter_categories')
export class LetterCategory extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'boolean', default: true })
  is_system: boolean;

  @Column({ type: 'boolean', default: false })
  is_deleted: boolean;
}
