import {
    Entity,
    Column,
    ManyToOne,
    JoinColumn,
    Index,
    PrimaryGeneratedColumn,
    CreateDateColumn,
    UpdateDateColumn,
} from 'typeorm';
import { Role } from './role.entity';
import { AppModule } from './module.entity';
import { Action } from './action.entity';

/**
 * ModuleAccess Entity
 *
 * Defines the permission matrix: which role can perform which action on which module.
 * access_flag = true  → permission GRANTED
 * access_flag = false → permission EXPLICITLY DENIED (can be used for overrides)
 *
 * Multiple roles can grant access to the same module+action combination.
 * PermissionResolver aggregates using OR logic across roles.
 */
@Entity('module_access')
@Index(['role_id', 'module_id', 'action_id'], { unique: true })
@Index(['role_id', 'module_id'])
export class ModuleAccess {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    role_id: string;

    @ManyToOne(() => Role, { eager: false, onDelete: 'CASCADE' })
    @JoinColumn({ name: 'role_id' })
    role: Role;

    @Column({ type: 'uuid' })
    module_id: string;

    @ManyToOne(() => AppModule, { eager: false, onDelete: 'CASCADE' })
    @JoinColumn({ name: 'module_id' })
    module: AppModule;

    @Column({ type: 'uuid' })
    action_id: string;

    @ManyToOne(() => Action, { eager: false, onDelete: 'CASCADE' })
    @JoinColumn({ name: 'action_id' })
    action: Action;

    /** true = permitted, false = denied */
    @Column({ type: 'boolean', default: false })
    access_flag: boolean;

    @CreateDateColumn({ type: 'timestamp' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamp' })
    updated_at: Date;
}
