import { Entity, Column, Index, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';
import { FeedbackStatus } from '../enums/feedback-status.enum';

@Entity('feedback_status_logs')
@Index('idx_feedback_status_log_ticket', ['ticket_id', 'created_at'])
export class FeedbackStatusLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  ticket_id: string;

  @Column({ type: 'uuid' })
  changed_by: string;

  @Column({ type: 'enum', enum: FeedbackStatus })
  old_status: FeedbackStatus;

  @Column({ type: 'enum', enum: FeedbackStatus })
  new_status: FeedbackStatus;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;
}
