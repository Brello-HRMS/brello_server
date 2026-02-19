import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

/**
 * App Entity
 *
 * Represents an application/product in the multi-app architecture.
 * Each app has roles, modules, and access rights associated with it.
 *
 * Priority determines the default app for a user when no last_access_app_id exists.
 * Lower number = higher priority (i.e., priority 1 is shown first).
 */
@Entity('app')
@Index(['name'], { unique: true })
export class App extends BaseEntity {
  /** Unique name of the application (e.g., HRMS, CRM, LMS) */
  @Column({ type: 'varchar', length: 100, unique: true })
  name: string;

  /** Lower number = higher priority (default app selection) */
  @Column({ type: 'int', default: 999 })
  priority: number;
}
