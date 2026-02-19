import {
    Entity,
    Column,
    Index,
    PrimaryGeneratedColumn,
    CreateDateColumn,
    UpdateDateColumn,
} from 'typeorm';

/**
 * PlanModule Entity
 *
 * Controls which modules are enabled for a given plan.
 * If a module is not enabled in the plan, it's hidden regardless of role access.
 */
@Entity('plan_module')
@Index(['plan_id', 'module_id'], { unique: true })
export class PlanModule {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    plan_id: string;

    @Column({ type: 'uuid' })
    module_id: string;

    /** Whether this module is enabled for this plan */
    @Column({ type: 'boolean', default: true })
    enabled: boolean;

    @CreateDateColumn({ type: 'timestamp' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamp' })
    updated_at: Date;
}
