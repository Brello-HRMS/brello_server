import {
    Entity,
    Column,
    Index,
    PrimaryGeneratedColumn,
    CreateDateColumn,
    UpdateDateColumn,
} from 'typeorm';

/**
 * PlanModuleAction Entity
 *
 * Fine-grained control: which actions are enabled per module per plan.
 * E.g., Free plan may have 'view' on Leave module but not 'approve'.
 *
 * PermissionResolver ANDs this with role-based module_access:
 *   effective_access = role_access AND plan_action_enabled
 */
@Entity('plan_module_action')
@Index(['plan_id', 'module_id', 'action_id'], { unique: true })
export class PlanModuleAction {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    plan_id: string;

    @Column({ type: 'uuid' })
    module_id: string;

    @Column({ type: 'uuid' })
    action_id: string;

    /** Whether this action is enabled for the plan+module combination */
    @Column({ type: 'boolean', default: true })
    enabled: boolean;

    @CreateDateColumn({ type: 'timestamp' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamp' })
    updated_at: Date;
}
