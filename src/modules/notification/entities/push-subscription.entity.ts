import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity('push_subscriptions')
@Unique(['endpoint'])
export class PushSubscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  user_id: string;

  @Column({ type: 'varchar', length: 500 })
  endpoint: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  p256dh: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  auth: string | null;

  @Column({ type: 'varchar', length: 20, default: 'web' })
  platform: string;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;
}
