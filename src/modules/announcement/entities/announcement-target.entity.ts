import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Announcement } from './announcement.entity';
import { AnnouncementTargetType } from '../enums/announcement.enum';

@Entity('announcement_targets')
@Index('idx_ann_target_announcement', ['announcement_id'])
@Index('idx_ann_target_type_id', ['target_type', 'target_id'])
export class AnnouncementTarget {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  announcement_id: string;

  @ManyToOne(() => Announcement, (a) => a.targets, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'announcement_id' })
  announcement: Announcement;

  @Column({ type: 'enum', enum: AnnouncementTargetType })
  target_type: AnnouncementTargetType;

  @Column({ type: 'uuid', nullable: true })
  target_id: string | null;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;
}
