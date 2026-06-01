import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

export const DOCUMENT_TYPES = [
  'hr_letter',
  'payslip',
  'onboarding',
  'policy',
  'notice',
  'certificate',
  'appraisal',
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

@Entity('letter_categories')
export class LetterCategory extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 50, default: 'hr_letter' })
  document_type: DocumentType;

  @Column({ type: 'boolean', default: true })
  is_system: boolean;

  @Column({ type: 'boolean', default: false })
  is_deleted: boolean;
}
