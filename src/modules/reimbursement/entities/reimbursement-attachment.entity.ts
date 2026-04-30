import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Reimbursement } from './reimbursement.entity';

@Entity('reimbursement_attachment')
export class ReimbursementAttachment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  reimbursement_id: string;

  @ManyToOne(() => Reimbursement, (r) => r.attachments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reimbursement_id' })
  reimbursement: Reimbursement;

  @Column({ type: 'uuid' })
  document_id: string;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;
}
