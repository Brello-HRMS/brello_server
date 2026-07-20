import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Offer } from './offer.entity';

/**
 * OfferVersion — Immutable snapshot of each offer revision.
 *
 * Created when:
 *  1. Offer is first sent (v1).
 *  2. Candidate requests changes and HR sends a new version.
 *
 * Only one version is ACTIVE at any time (is_active = true).
 * The secure token links to a specific version (for candidate portal access).
 */
@Entity('offer_versions')
@Index(['offer_id', 'version_number'])
@Index(['access_token'], { unique: true })
export class OfferVersion extends BaseEntity {
  @Column({ type: 'uuid' })
  offer_id: string;

  @ManyToOne(() => Offer, { eager: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'offer_id' })
  offer: Offer;

  @Column({ type: 'int' })
  version_number: number;

  /** Whether this is the currently active version the candidate can see. */
  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  /** What changed in this version (HR-authored note). */
  @Column({ type: 'text', nullable: true })
  change_summary: string | null;

  // ── Secure Token ───────────────────────────────────────────────────────────

  /** UUIDv4 token. Invalidated when a new version is created or offer withdrawn. */
  @Column({ type: 'varchar', length: 100 })
  access_token: string;

  @Column({ type: 'timestamp', nullable: true })
  token_expires_at: Date | null;

  // ── PDF Snapshot ───────────────────────────────────────────────────────────

  /** Immutable URL to the generated PDF for this version. */
  @Column({ type: 'varchar', length: 500, nullable: true })
  pdf_url: string | null;

  @Column({ type: 'timestamp', nullable: true })
  pdf_generated_at: Date | null;

  /** Watermarked/stamped copy generated at acceptance time — the candidate's proof of acceptance. */
  @Column({ type: 'varchar', length: 500, nullable: true })
  accepted_pdf_url: string | null;

  @Column({ type: 'timestamp', nullable: true })
  accepted_pdf_generated_at: Date | null;

  // ── Candidate Response ─────────────────────────────────────────────────────

  @Column({ type: 'timestamp', nullable: true })
  viewed_at: Date | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  candidate_response: 'accepted' | 'rejected' | 'changes_requested' | null;

  @Column({ type: 'timestamp', nullable: true })
  responded_at: Date | null;

  /** Candidate's counter-offer data (expected salary, joining date, comments). */
  @Column({ type: 'jsonb', nullable: true })
  negotiation_request: {
    expected_salary?: number;
    preferred_joining_date?: string;
    comments: string;
    attachments?: string[];
  } | null;
}
