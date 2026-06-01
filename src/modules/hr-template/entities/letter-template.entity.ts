import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { LetterCategory } from './letter-category.entity';

@Entity('letter_templates')
export class LetterTemplate extends BaseEntity {
  @Column({ type: 'uuid' })
  category_id: string;

  @ManyToOne(() => LetterCategory, { eager: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'category_id' })
  category: LetterCategory;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  subject: string;

  @Column({ type: 'text', default: '' })
  content: string;

  @Column({ type: 'jsonb', default: [] })
  variables: string[];

  @Column({ type: 'jsonb', nullable: true, default: null })
  design: object | null;

  @Column({ type: 'boolean', default: true })
  is_system: boolean;

  @Column({ type: 'boolean', default: false })
  is_deleted: boolean;
}
