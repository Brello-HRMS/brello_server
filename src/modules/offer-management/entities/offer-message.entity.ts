import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

/**
 * OfferMessage — Communication between HR and candidate (V2 Negotiation Workspace).
 *
 * Replaces ad-hoc email chains. Both HR and candidate can send messages.
 * All messages are archived and visible in the offer timeline.
 */
@Entity('offer_messages')
@Index(['offer_id', 'created_at'])
export class OfferMessage extends BaseEntity {
  @Column({ type: 'uuid' })
  offer_id: string;

  /** 'hr' = HR user, 'candidate' = candidate via portal. */
  @Column({ type: 'varchar', length: 20 })
  sender_type: 'hr' | 'candidate';

  /** UUID of the HR user. Null if sent by candidate. */
  @Column({ type: 'uuid', nullable: true })
  sender_id: string | null;

  /** Display name at time of send (denormalized). */
  @Column({ type: 'varchar', length: 200 })
  sender_name: string;

  @Column({ type: 'text' })
  message: string;

  /** Optional file attachments. */
  @Column({ type: 'jsonb', default: [] })
  attachments: string[];

  /** Whether the other party has read this message. */
  @Column({ type: 'boolean', default: false })
  is_read: boolean;

  @Column({ type: 'timestamp', nullable: true })
  read_at: Date | null;
}
