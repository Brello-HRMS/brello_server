import { Entity, Column, Index, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('feedback_comments')
@Index('idx_feedback_comment_ticket', ['ticket_id', 'is_internal', 'created_at'], {
  where: 'deleted_at IS NULL',
})
export class FeedbackComment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  ticket_id: string;

  @Column({ type: 'uuid' })
  author_id: string;

  @Column({ type: 'text' })
  body: string;

  @Column({ type: 'boolean', default: false })
  is_internal: boolean;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  deleted_at: Date | null;

  @Column({ type: 'uuid', nullable: true })
  deleted_by: string | null;
}
