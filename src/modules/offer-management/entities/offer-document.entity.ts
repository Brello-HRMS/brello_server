import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

/**
 * OfferDocument — Preboarding document submitted by candidate (V2).
 *
 * Candidates upload documents (Aadhaar, PAN, Resume, Certificates, etc.)
 * after accepting the offer. HR can verify/reject each document.
 */
@Entity('offer_documents')
@Index(['offer_id'])
export class OfferDocument extends BaseEntity {
  @Column({ type: 'uuid' })
  offer_id: string;

  /** Document type label (e.g., "Aadhaar", "PAN", "Resume", "Experience Letter"). */
  @Column({ type: 'varchar', length: 100 })
  document_type: string;

  /** URL to the uploaded file in object storage. */
  @Column({ type: 'varchar', length: 500 })
  file_url: string;

  /** Original filename uploaded by the candidate. */
  @Column({ type: 'varchar', length: 255, nullable: true })
  original_filename: string | null;

  /** Verification status: pending | verified | rejected. */
  @Column({
    type: 'varchar',
    length: 20,
    default: 'pending',
  })
  verification_status: 'pending' | 'verified' | 'rejected';

  /** HR verifier UUID. */
  @Column({ type: 'uuid', nullable: true })
  verified_by: string | null;

  @Column({ type: 'timestamp', nullable: true })
  verified_at: Date | null;

  @Column({ type: 'text', nullable: true })
  rejection_reason: string | null;

  /** Was this uploaded by the candidate (true) or HR (false)? */
  @Column({ type: 'boolean', default: true })
  uploaded_by_candidate: boolean;
}
