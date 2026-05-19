import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('recent_searches')
@Index('idx_recent_search_user', ['enterprise_id', 'user_id'])
export class RecentSearch {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  enterprise_id: string;

  @Column({ type: 'uuid', nullable: true })
  organization_id: string;

  @Column({ type: 'uuid' })
  user_id: string;

  @Column({ type: 'text', nullable: true })
  query: string;

  @Column({ type: 'varchar', nullable: true })
  entity_id: string;

  @Column({ type: 'varchar', nullable: true })
  entity_type: string;

  @Column({ type: 'text', nullable: true })
  title: string;

  @Column({ type: 'varchar', nullable: true })
  route: string;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;
}
