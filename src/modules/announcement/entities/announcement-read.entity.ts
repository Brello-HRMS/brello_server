import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { Announcement } from './announcement.entity';

@Entity('announcement_reads')
@Unique('uk_ann_read_employee', ['announcement_id', 'employee_id'])
@Index('idx_ann_read_employee', ['employee_id'])
export class AnnouncementRead {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  announcement_id: string;

  @ManyToOne(() => Announcement, (a) => a.reads, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'announcement_id' })
  announcement: Announcement;

  @Column({ type: 'uuid' })
  employee_id: string;

  @Column({ type: 'timestamp' })
  viewed_at: Date;

  @Column({ type: 'boolean', default: false })
  notification_clicked: boolean;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;
}
