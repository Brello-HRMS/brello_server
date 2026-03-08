import { Entity, Column, Index, Unique } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { StorageProvider, FolderType } from '../enums/document.enum';

@Entity('document')
@Index('idx_document_tenant', ['enterprise_id', 'organization_id'], {
  where: "status != 'DELETED'",
})
@Index('idx_document_employee', ['employee_id'], {
  where: "status != 'DELETED'",
})
@Index('idx_document_folder_type', ['folder_type'])
@Unique(['enterprise_id', 'organization_id', 'object_key'])
export class Document extends BaseEntity {
  // Ownership relation (optional)
  @Column({ type: 'uuid', nullable: true })
  employee_id: string;

  // File metadata
  @Column({ type: 'varchar', length: 255 })
  original_name: string;

  @Column({ type: 'varchar', length: 255 })
  file_name: string;

  @Column({ type: 'varchar', length: 50 })
  extension: string;

  @Column({ type: 'varchar', length: 100 })
  mime_type: string;

  @Column({ type: 'bigint' })
  size: number;

  // Storage
  @Column({
    type: 'enum',
    enum: StorageProvider,
    default: StorageProvider.S3,
  })
  storage_provider: StorageProvider;

  @Column({ type: 'varchar', length: 255 })
  bucket: string;

  @Column({ type: 'varchar', length: 1024 })
  object_key: string;

  @Column({
    type: 'enum',
    enum: FolderType,
  })
  folder_type: FolderType;

  @Column({ type: 'boolean', default: false })
  is_public: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  checksum: string;

  @Column({ type: 'int', default: 1 })
  version: number;
}
