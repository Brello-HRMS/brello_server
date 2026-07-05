import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../../../common/entities/base.entity';
import type {
  SalaryTableModel,
  SignatoryModel,
} from '../../shared/interfaces/render-model.interface';

/**
 * An immutable, issued organizational document. Never updated or deleted —
 * every field needed to reproduce the exact letter as issued is snapshotted
 * here so later changes to the employee, template, or org profile can never
 * retroactively alter a document that has already been handed to someone.
 */
@Entity('issued_letters')
@Index(['organization_id', 'employee_id'])
@Index(['organization_id', 'generated_at'])
@Index(['organization_id', 'letter_number'], { unique: true })
@Index(['organization_id', 'idempotency_key'], {
  unique: true,
  where: '"idempotency_key" IS NOT NULL',
})
export class IssuedLetter extends BaseEntity {
  @Column({ type: 'uuid' })
  employee_id: string;

  @Column({ type: 'uuid' })
  template_id: string;

  @Column({ type: 'int' })
  template_version: number;

  @Column({ type: 'uuid' })
  category_id: string;

  @Column({ type: 'varchar', length: 40 })
  letter_number: string;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'jsonb' })
  variable_snapshot: Record<string, string>;

  @Column({ type: 'text', nullable: true })
  heading_snapshot: string | null;

  @Column({ type: 'jsonb', default: [] })
  paragraphs_snapshot: string[];

  @Column({ type: 'jsonb', default: [] })
  bullets_snapshot: string[];

  @Column({ type: 'jsonb', nullable: true })
  salary_snapshot: SalaryTableModel | null;

  @Column({ type: 'jsonb', nullable: true })
  signatory_snapshot: SignatoryModel | null;

  @Column({ type: 'uuid' })
  pdf_document_id: string;

  @Column({ type: 'uuid' })
  generated_by: string;

  @Column({ type: 'timestamp' })
  generated_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  archived_at: Date | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  idempotency_key: string | null;
}
