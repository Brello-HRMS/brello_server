import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../../../common/entities/base.entity';

@Entity('letter_settings')
@Index(['organization_id'], { unique: true })
export class LetterSettings extends BaseEntity {
  @Column({ type: 'varchar', length: 20, default: 'BRLO' })
  letter_prefix: string;

  @Column({ type: 'int' })
  current_year: number;

  @Column({ type: 'int', default: 0 })
  last_sequence: number;

  @Column({ type: 'uuid', nullable: true })
  default_signatory_id: string | null;

  @Column({ type: 'varchar', length: 30, default: 'DD MMM YYYY' })
  date_format: string;
}
