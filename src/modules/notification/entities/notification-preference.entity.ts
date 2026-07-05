import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { NotificationType } from '../../../common/enums/notification-type.enum';

@Entity('notification_preferences')
@Unique(['user_id', 'channel', 'event_type'])
export class NotificationPreference {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  user_id: string;

  @Column({ type: 'enum', enum: NotificationType })
  channel: NotificationType;

  @Column({ type: 'varchar', length: 100 })
  event_type: string;

  @Column({ default: true })
  enabled: boolean;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;
}
