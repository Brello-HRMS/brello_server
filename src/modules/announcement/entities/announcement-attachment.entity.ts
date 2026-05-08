import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Announcement } from './announcement.entity';

@Entity('announcement_attachments')
export class AnnouncementAttachment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  announcement_id: string;

  @ManyToOne(() => Announcement, (a) => a.attachments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'announcement_id' })
  announcement: Announcement;

  @Column({ type: 'varchar', length: 255, nullable: true })
  file_name: string | null;

  @Column({ type: 'text', nullable: true })
  file_url: string | null;

  @Column({ type: 'bigint', nullable: true })
  file_size: number | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  mime_type: string | null;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;
}
