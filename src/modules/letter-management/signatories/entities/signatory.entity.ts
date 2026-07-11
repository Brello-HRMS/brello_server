import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../../../common/entities/base.entity';

@Entity('signatories')
@Index(['organization_id', 'status'])
export class Signatory extends BaseEntity {
  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'varchar', length: 120 })
  designation: string;

  @Column({ type: 'uuid', nullable: true })
  signature_document_id: string | null;

  @Column({ type: 'boolean', default: false })
  is_default: boolean;
}
