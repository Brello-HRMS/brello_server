import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { FeedbackType } from '../enums/feedback-type.enum';
import { FeedbackCategory } from '../enums/feedback-category.enum';
import { FeedbackStatus } from '../enums/feedback-status.enum';
import { FeedbackPriority } from '../enums/feedback-priority.enum';

@Entity('feedback_tickets')
@Index('idx_feedback_ticket_org_status', ['organization_id', 'ticket_status'], {
  where: 'deleted_at IS NULL',
})
@Index('idx_feedback_ticket_tenant_type_status', ['enterprise_id', 'type', 'ticket_status'], {
  where: 'deleted_at IS NULL',
})
@Index('idx_feedback_ticket_submitted_by', ['submitted_by'], {
  where: 'deleted_at IS NULL',
})
@Index('idx_feedback_ticket_created_at', ['created_at'])
export class FeedbackTicket extends BaseEntity {
  @Column({ type: 'uuid' })
  submitted_by: string;

  @Column({ type: 'enum', enum: FeedbackType })
  type: FeedbackType;

  @Column({ type: 'enum', enum: FeedbackCategory })
  category: FeedbackCategory;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text' })
  ticket_description: string;

  @Column({
    type: 'enum',
    enum: FeedbackStatus,
    default: FeedbackStatus.SUBMITTED,
  })
  ticket_status: FeedbackStatus;

  @Column({
    type: 'enum',
    enum: FeedbackPriority,
    default: FeedbackPriority.MEDIUM,
  })
  priority: FeedbackPriority;

  @Column({ type: 'varchar', length: 100, nullable: true })
  affected_module: string | null;

  @Column({ type: 'jsonb', nullable: true })
  attachments: { document_id: string; name: string; mime_type: string }[] | null;

  @Column({ type: 'timestamp', nullable: true })
  resolved_at: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  closed_at: Date | null;

  @Column({ type: 'uuid' })
  created_by: string;
}
