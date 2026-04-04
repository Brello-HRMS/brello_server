import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

/**
 * Action Entity
 *
 * Represents a granular permission action (e.g., view, create, update, delete, approve).
 * Actions are system-level and shared across all apps.
 */
@Entity('actions')
@Index(['name'], { unique: true })
export class Action extends BaseEntity {
  /** action name for UI display (e.g., View, Create, Update, Delete) */
  @Column({ type: 'varchar', length: 50, unique: true })
  name: string;
}
