import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';

@Entity('global_search_documents')
@Index('idx_search_tenant', ['enterprise_id'])
@Index('idx_search_entity', ['entity_type'])
@Index('idx_search_active', ['is_active'])
@Unique('uq_search_doc_entity', ['enterprise_id', 'entity_id', 'entity_type'])
export class GlobalSearchDocument {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  enterprise_id: string;

  @Column({ type: 'uuid', nullable: true })
  organization_id: string;

  @Column({ type: 'varchar' })
  entity_id: string;

  @Column({ type: 'varchar' })
  entity_type: string;

  @Column({ type: 'varchar' })
  module_key: string;

  @Column({ type: 'text' })
  title: string;

  @Column({ type: 'text', nullable: true })
  subtitle: string;

  @Column({ type: 'text', nullable: true })
  keywords: string;

  @Column({ type: 'varchar' })
  route: string;

  @Column({ type: 'text', array: true, nullable: true })
  permissions: string[];

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @Column({ type: 'boolean', default: false })
  is_deleted: boolean;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;
}
