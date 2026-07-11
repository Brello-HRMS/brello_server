import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../../common/entities/base.entity';
import { LetterCategory } from '../../categories/entities/letter-category.entity';
import { Signatory } from '../../signatories/entities/signatory.entity';
import { TemplateStatus } from '../enums/template-status.enum';

@Entity('letter_templates')
@Index(['organization_id', 'category_id'])
@Index(['organization_id', 'template_status'])
export class LetterTemplate extends BaseEntity {
  @Column({ type: 'uuid' })
  category_id: string;

  @ManyToOne(() => LetterCategory, { eager: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'category_id' })
  category: LetterCategory;

  @Column({ type: 'varchar', length: 150 })
  name: string;

  @Column({ type: 'text', nullable: true })
  heading: string | null;

  @Column({ type: 'jsonb', default: [] })
  paragraphs: string[];

  @Column({ type: 'jsonb', default: [] })
  bullet_list: string[];

  @Column({ type: 'boolean', default: false })
  include_salary_table: boolean;

  @Column({ type: 'uuid', nullable: true })
  signatory_id: string | null;

  @ManyToOne(() => Signatory, { eager: false, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'signatory_id' })
  signatory: Signatory | null;

  /** Derived cache of placeholder keys used in heading/paragraphs/bullet_list — recomputed on save/publish. */
  @Column({ type: 'jsonb', default: [] })
  variables: string[];

  @Column({ type: 'int', default: 1 })
  version: number;

  @Column({
    type: 'enum',
    enum: TemplateStatus,
    default: TemplateStatus.DRAFT,
  })
  template_status: TemplateStatus;
}
