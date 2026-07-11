import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { OfferTemplateStatus } from '../enums/offer-template-status.enum';

/**
 * OfferTemplate — HR-authored offer letter template.
 *
 * Separate from HR Letter Templates (letter-management module).
 * Supports Markdown body with {{variable}} placeholders.
 * Used in the Offer Creation Wizard (Step 5).
 */
@Entity('offer_templates')
@Index(['organization_id', 'template_status'])
export class OfferTemplate extends BaseEntity {
  @Column({ type: 'varchar', length: 150 })
  name: string;

  /** Markdown/rich-text body. Supports {{candidate_name}}, {{position}}, {{ctc}}, etc. */
  @Column({ type: 'text', nullable: true })
  body: string | null;

  /** Extracted variable placeholder keys from body, recomputed on save. */
  @Column({ type: 'jsonb', default: [] })
  variables: string[];

  @Column({ type: 'int', default: 1 })
  version: number;

  @Column({
    type: 'enum',
    enum: OfferTemplateStatus,
    default: OfferTemplateStatus.DRAFT,
  })
  template_status: OfferTemplateStatus;

  /** Optional signatory UUID from signatories table. */
  @Column({ type: 'uuid', nullable: true })
  signatory_id: string | null;

  /** Whether to include salary breakdown table in the generated PDF. */
  @Column({ type: 'boolean', default: true })
  include_salary_table: boolean;
}
