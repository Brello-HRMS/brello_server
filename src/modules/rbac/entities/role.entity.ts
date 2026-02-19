import { Entity, Column, ManyToOne, JoinColumn, Index, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { App } from '../../app/entities/app.entity';

/**
 * Role Entity
 *
 * A role belongs to exactly one app.
 * Each organization can define its own custom roles per app.
 * System-defined roles are seeded and cannot be modified by users.
 */
@Entity('roles')
@Index(['app_id', 'organization_id', 'name'])
export class Role extends BaseEntity {
    /** Human-readable role name (e.g., Admin, HR Manager, Viewer) */
    @Column({ type: 'varchar', length: 100 })
    name: string;

    /** The app this role belongs to */
    @Column({ type: 'uuid' })
    app_id: string;

    @ManyToOne(() => App, { eager: false, onDelete: 'CASCADE' })
    @JoinColumn({ name: 'app_id' })
    app: App;

    /** Whether this role is pre-seeded and non-editable */
    @Column({ type: 'boolean', default: false })
    is_system_defined: boolean;
}
