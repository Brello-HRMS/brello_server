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
  /** Unique action name (view | create | update | delete | approve | export) */
  @Column({ type: 'varchar', length: 50, unique: true })
  name: string;
}
