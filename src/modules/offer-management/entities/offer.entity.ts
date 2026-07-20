import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { OfferStatus } from '../enums/offer-status.enum';
import { OfferCandidate } from './offer-candidate.entity';
import { EmploymentType, WorkMode } from './offer-candidate.entity';

/**
 * Offer — The core offer entity.
 *
 * One Offer per candidate (offer_number is stable across versions).
 * The current accepted / active state is always tracked here.
 * Individual snapshots are stored in OfferVersion (child rows).
 *
 * Business rules:
 *  - offer_number generated only on first send (stays null while DRAFT).
 *  - current_version increments each time a new OfferVersion is created.
 *  - Accepted offers cannot be withdrawn or edited.
 *  - Only one active OfferVersion may exist at a time.
 */
@Entity('offers')
@Index(['organization_id', 'offer_status'])
@Index(['organization_id', 'candidate_id'], { unique: true })
export class Offer extends BaseEntity {
  // ── Candidate ──────────────────────────────────────────────────────────────

  @Column({ type: 'uuid' })
  candidate_id: string;

  @ManyToOne(() => OfferCandidate, { eager: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'candidate_id' })
  candidate: OfferCandidate;

  // ── Offer Identity ─────────────────────────────────────────────────────────

  /** OFF-2026-000145. Generated on first send; null while DRAFT. */
  @Column({ type: 'varchar', length: 30, nullable: true, unique: true })
  offer_number: string | null;

  @Column({
    type: 'enum',
    enum: OfferStatus,
    default: OfferStatus.DRAFT,
  })
  offer_status: OfferStatus;

  @Column({ type: 'int', default: 1 })
  current_version: number;

  // ── Offer Details ──────────────────────────────────────────────────────────

  @Column({ type: 'uuid', nullable: true })
  template_id: string | null;

  @Column({ type: 'text', nullable: true })
  custom_letter_html: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  position: string | null;

  @Column({ type: 'uuid', nullable: true })
  department_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  designation_id: string | null;

  @Column({
    type: 'enum',
    enum: EmploymentType,
    nullable: true,
  })
  employment_type: EmploymentType | null;

  @Column({ type: 'date', nullable: true })
  joining_date: Date | null;

  @Column({ type: 'uuid', nullable: true })
  reporting_manager_id: string | null;

  @Column({
    type: 'enum',
    enum: WorkMode,
    default: WorkMode.ONSITE,
    nullable: true,
  })
  work_mode: WorkMode | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  work_location: string | null;

  @Column({ type: 'text', nullable: true })
  office_address: string | null;

  @Column({ type: 'int', nullable: true })
  probation_days: number | null;

  @Column({ type: 'int', nullable: true })
  notice_period_days: number | null;

  // ── Compensation ───────────────────────────────────────────────────────────

  @Column({ type: 'uuid', nullable: true })
  salary_structure_id: string | null;

  /** Annual CTC in INR (base currency). */
  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  ctc_annual: number | null;

  /** Monthly take-home calculated from CTC. */
  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  monthly_take_home: number | null;

  /** Snapshot of salary components at time of offer draft/update. */
  @Column({ type: 'jsonb', default: [] })
  salary_components: Array<{ name: string; amount: number; type: 'fixed' | 'variable' }>;

  // ── Policies ───────────────────────────────────────────────────────────────

  /** UUIDs of company_policy rows to attach. */
  @Column({ type: 'jsonb', default: [] })
  policy_ids: string[];

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  /** Expiry config (days). Derived from org settings; stored per-offer for immutability. */
  @Column({ type: 'int', default: 7 })
  expiry_days: number;

  /** Null while DRAFT; populated on first send. */
  @Column({ type: 'timestamp', nullable: true })
  sent_at: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  expires_at: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  viewed_at: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  accepted_at: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  rejected_at: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  withdrawn_at: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  synced_at: Date | null;

  /** Employee ID after successful sync. */
  @Column({ type: 'uuid', nullable: true })
  synced_employee_id: string | null;

  // ── Candidate Feedback ─────────────────────────────────────────────────────

  @Column({ type: 'text', nullable: true })
  rejection_reason: string | null;

  @Column({ type: 'text', nullable: true })
  candidate_comment: string | null;

  // ── V2: Approval ───────────────────────────────────────────────────────────

  /** Whether this offer requires approval before sending. */
  @Column({ type: 'boolean', default: false })
  requires_approval: boolean;

  /** Index of the next pending approval step (null = no pending). */
  @Column({ type: 'int', nullable: true })
  current_approval_step: number | null;

  // ── V2: Branding ──────────────────────────────────────────────────────────

  /** Brand ID for multi-brand support. */
  @Column({ type: 'uuid', nullable: true })
  brand_id: string | null;
}
