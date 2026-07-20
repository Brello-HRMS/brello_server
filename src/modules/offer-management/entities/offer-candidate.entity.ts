import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

/** Employment types a candidate can be hired under. */
export enum EmploymentType {
  FULL_TIME = 'FULL_TIME',
  PART_TIME = 'PART_TIME',
  CONTRACT = 'CONTRACT',
  INTERNSHIP = 'INTERNSHIP',
  CONSULTANT = 'CONSULTANT',
}

/** Work mode options for the offer. */
export enum WorkMode {
  ONSITE = 'ONSITE',
  REMOTE = 'REMOTE',
  HYBRID = 'HYBRID',
}

/**
 * OfferCandidate — A candidate who is eligible to receive an offer.
 *
 * Created before the offer is drafted. Stores personal and professional details
 * that will be used to pre-fill the Offer Creation Wizard.
 */
@Entity('offer_candidates')
@Index(['organization_id'])
@Index(['organization_id', 'email'], { unique: true })
export class OfferCandidate extends BaseEntity {
  // ── Personal Details ───────────────────────────────────────────────────────

  @Column({ type: 'varchar', length: 100 })
  first_name: string;

  @Column({ type: 'varchar', length: 100 })
  last_name: string;

  @Column({ type: 'varchar', length: 200 })
  email: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone: string | null;

  // ── Professional Details ───────────────────────────────────────────────────

  @Column({ type: 'varchar', length: 150, nullable: true })
  current_company: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  current_designation: string | null;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  experience_years: number | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  resume_url: string | null;

  /** Applied-for position label (free text, not linked to designations table). */
  @Column({ type: 'varchar', length: 150, nullable: true })
  applied_for: string | null;

  /** Recruiter user UUID who manages this candidate. */
  @Column({ type: 'uuid', nullable: true })
  recruiter_id: string | null;

  /** Internal notes visible only to HR/recruiter. */
  @Column({ type: 'text', nullable: true })
  recruiter_notes: string | null;

  /** Pre-onboarding documents uploaded by the candidate after acceptance. */
  @Column({ type: 'jsonb', nullable: true })
  onboarding_documents: { name: string; url: string; uploaded_at: string }[] | null;
}
