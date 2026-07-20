import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

/**
 * OfferSettings — Organization-level configuration for the Offer module.
 *
 * One row per organization_id. Created lazily with defaults on first access.
 */
@Entity('offer_settings')
@Index(['organization_id'], { unique: true })
export class OfferSettings extends BaseEntity {
  /** Prefix for offer numbers. Default: "OFF". */
  @Column({ type: 'varchar', length: 20, default: 'OFF' })
  offer_prefix: string;

  /** Days before an offer expires. Default: 7. */
  @Column({ type: 'int', default: 7 })
  offer_expiry_days: number;

  /** Day number(s) on which reminder emails are sent before expiry. */
  @Column({ type: 'jsonb', default: [3, 1] })
  reminder_days_before_expiry: number[];

  /** UUID of the default offer template. */
  @Column({ type: 'uuid', nullable: true })
  default_template_id: string | null;

  /** UUID of the default signatory. */
  @Column({ type: 'uuid', nullable: true })
  default_signatory_id: string | null;

  /** Whether candidates can download the offer PDF. */
  @Column({ type: 'boolean', default: true })
  allow_download: boolean;

  /** Whether candidates can request changes. */
  @Column({ type: 'boolean', default: true })
  enable_request_changes: boolean;

  /** Whether digital signature is embedded in the PDF. */
  @Column({ type: 'boolean', default: true })
  enable_digital_signature: boolean;

  /** Whether to send a welcome email automatically on acceptance. */
  @Column({ type: 'boolean', default: true })
  auto_welcome_email: boolean;

  /** Approval chain config: array of { role_name, requires_at_ctc_above? } */
  @Column({ type: 'jsonb', default: [] })
  approval_chain: Array<{
    role_name: string;
    requires_at_ctc_above?: number;
  }>;

  /** Last used sequence number for offer numbering (per year). */
  @Column({ type: 'int', default: 0 })
  last_sequence: number;

  @Column({ type: 'int', default: new Date().getFullYear() })
  sequence_year: number;

  /** Dynamic list of onboarding documents required from the candidate. */
  @Column({ type: 'jsonb', default: [] })
  required_onboarding_documents: Array<{ name: string; is_required: boolean; description?: string }>;
}
