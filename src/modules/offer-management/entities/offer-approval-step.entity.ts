import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { OfferApprovalStatus } from '../enums/offer-approval-status.enum';
import { Offer } from './offer.entity';

/**
 * OfferApprovalStep — A single step in the approval chain for an offer.
 *
 * Steps are ordered by step_order. All steps must be APPROVED before
 * the offer can be sent to the candidate.
 *
 * Example chain: step_order 1 = Manager, 2 = Director, 3 = Finance.
 */
@Entity('offer_approval_steps')
@Index(['offer_id', 'step_order'])
export class OfferApprovalStep extends BaseEntity {
  @Column({ type: 'uuid' })
  offer_id: string;

  @ManyToOne(() => Offer)
  @JoinColumn({ name: 'offer_id' })
  offer: Offer;

  /** Display name of the approver role (e.g., "Manager", "Finance Head"). */
  @Column({ type: 'varchar', length: 100 })
  role_name: string;

  /** The actual user assigned to approve this step. */
  @Column({ type: 'uuid' })
  approver_id: string;

  @Column({ type: 'int' })
  step_order: number;

  @Column({
    type: 'enum',
    enum: OfferApprovalStatus,
    default: OfferApprovalStatus.PENDING,
  })
  approval_status: OfferApprovalStatus;

  /** Internal comment from the approver (not visible to candidate). */
  @Column({ type: 'text', nullable: true })
  comment: string | null;

  @Column({ type: 'timestamp', nullable: true })
  actioned_at: Date | null;
}
