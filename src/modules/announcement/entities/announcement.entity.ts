import { Entity, Column, Index, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import {
  AnnouncementStatus,
  AnnouncementPriority,
  AnnouncementPublishType,
} from '../enums/announcement.enum';
import { AnnouncementTarget } from './announcement-target.entity';
import { AnnouncementRead } from './announcement-read.entity';
import { AnnouncementAttachment } from './announcement-attachment.entity';

@Entity('announcements')
@Index('idx_announcement_tenant_status', ['enterprise_id', 'organization_id', 'status'], {
  where: 'deleted_at IS NULL',
})
@Index('idx_announcement_scheduled_at', ['scheduled_at'])
@Index('idx_announcement_published_at', ['published_at'])
export class Announcement extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text' })
  description_html: string;

  @Column({
    type: 'enum',
    enum: AnnouncementPriority,
    default: AnnouncementPriority.NORMAL,
  })
  priority: AnnouncementPriority;

  @Column({
    type: 'enum',
    enum: AnnouncementStatus,
    default: AnnouncementStatus.DRAFT,
  })
  ann_status: AnnouncementStatus;

  @Column({
    type: 'enum',
    enum: AnnouncementPublishType,
  })
  publish_type: AnnouncementPublishType;

  @Column({ type: 'timestamp', nullable: true })
  scheduled_at: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  published_at: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  archived_at: Date | null;

  @Column({ type: 'boolean', default: true })
  send_push: boolean;

  @Column({ type: 'boolean', default: true })
  send_email: boolean;

  @Column({ type: 'uuid' })
  created_by: string;

  @Column({ type: 'uuid', nullable: true })
  updated_by: string | null;

  @OneToMany(() => AnnouncementTarget, (t) => t.announcement, { cascade: true })
  targets: AnnouncementTarget[];

  @OneToMany(() => AnnouncementRead, (r) => r.announcement)
  reads: AnnouncementRead[];

  @OneToMany(() => AnnouncementAttachment, (a) => a.announcement, { cascade: true })
  attachments: AnnouncementAttachment[];
}
