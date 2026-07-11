import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { OfferTimelineEvent } from '../enums/offer-timeline-event.enum';

/**
 * OfferTimeline — Full audit trail of every event on an offer.
 *
 * Append-only. Never mutated after insert.
 * actor_id = null means the event was triggered by the candidate or system.
 */
@Entity('offer_timeline')
@Index(['offer_id', 'created_at'])
export class OfferTimeline extends BaseEntity {
  @Column({ type: 'uuid' })
  offer_id: string;

  @Column({ type: 'uuid', nullable: true })
  offer_version_id: string | null;

  @Column({
    type: 'enum',
    enum: OfferTimelineEvent,
  })
  event: OfferTimelineEvent;

  /** Human-readable label shown in the timeline UI. */
  @Column({ type: 'varchar', length: 255 })
  label: string;

  /** Additional structured data for the event (e.g., version diff, rejection reason). */
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  /** HR user who triggered the event. Null for candidate or system events. */
  @Column({ type: 'uuid', nullable: true })
  actor_id: string | null;

  /** Display name of the actor at time of event (denormalized for immutability). */
  @Column({ type: 'varchar', length: 200, nullable: true })
  actor_name: string | null;
}
