import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  OneToMany,
  Tree,
  TreeChildren,
  TreeParent,
} from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { App } from '../../app/entities/app.entity';

export enum ModuleType {
  MOD = 'mod',
  SUBMOD = 'submod',
}

/**
 * AppModule Entity
 *
 * Represents a module/feature within an application.
 * WBS codes provide hierarchical ordering (1, 1.1, 1.1.1).
 * Supports parent-child relationships for tree building (menu).
 *
 * Named AppModule to avoid conflict with NestJS's Module decorator.
 */
@Entity('modules')
@Index(['app_id', 'code'], { unique: true })
@Index(['app_id', 'wbs_code'])
@Index(['app_id', 'parent_id'])
export class AppModule extends BaseEntity {
  /** Module display name (e.g., Leave Management, Attendance) */
  @Column({ type: 'varchar', length: 150 })
  name: string;

  /**
   * Stable module code used for permission lookups (e.g. LEAVE_MGMT, ATTENDANCE).
   * Unique per app. WBS code is used only for hierarchy display/ordering.
   * Overrides BaseEntity.code to enforce non-nullable and longer length.
   */
  @Column({ type: 'varchar', length: 100, nullable: false })
  declare code: string;

  /** The app this module belongs to */
  @Column({ type: 'uuid' })
  app_id: string;

  @ManyToOne(() => App, { eager: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'app_id' })
  app: App;

  /**
   * WBS (Work Breakdown Structure) code.
   * Hierarchical dot-notation: '1', '1.1', '1.1.2'
   * Used for ordering and tree traversal.
   */
  @Column({ type: 'varchar', length: 50 })
  wbs_code: string;

  /** Parent module id — null for root modules */
  @Column({ type: 'uuid', nullable: true })
  parent_id: string;

  @ManyToOne(() => AppModule, { nullable: true, eager: false })
  @JoinColumn({ name: 'parent_id' })
  parent: AppModule;

  @OneToMany(() => AppModule, (m) => m.parent)
  children: AppModule[];

  /** 'mod' for top-level modules, 'submod' for nested */
  @Column({ type: 'enum', enum: ModuleType, default: ModuleType.MOD })
  type: ModuleType;
}
