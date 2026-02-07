import {
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { Status } from '../enums';

/**
 * Base Entity
 * 
 * Abstract base class that provides common fields for all entities.
 * Implements the DRY (Don't Repeat Yourself) principle by centralizing
 * shared entity properties.
 * 
 * Design Pattern: Template Method Pattern
 * - Defines the skeleton of entity structure
 * - Subclasses inherit common fields and can add specific fields
 * 
 * @abstract
 */
export abstract class BaseEntity {
    /**
     * Unique identifier for the entity
     * Uses UUID v4 for better security and distribution
     */
    @PrimaryGeneratedColumn('uuid')
    id: string;

    /**
     * Reference to the enterprise this entity belongs to
     * Part of multi-tenant architecture
     */
    @Column({ type: 'uuid', nullable: true })
    enterprise_id: string;

    /**
     * Reference to the organization this entity belongs to
     * Part of multi-tenant architecture (second level)
     */
    @Column({ type: 'uuid', nullable: true })
    organization_id: string;

    /**
     * Current status of the entity
     * Used for soft deletion and lifecycle management
     */
    @Column({
        type: 'enum',
        enum: Status,
        default: Status.ACTIVE,
    })
    status: Status;

    /**
     * Human-readable code for the entity
     * Can be used for display purposes or as an alternative identifier
     */
    @Column({ type: 'varchar', length: 50, nullable: true })
    code: string;

    /**
     * Detailed description of the entity
     */
    @Column({ type: 'text', nullable: true })
    description: string;

    /**
     * Timestamp when the entity was created
     * Automatically set by TypeORM
     */
    @CreateDateColumn({ type: 'timestamp' })
    created_at: Date;

    /**
     * Timestamp when the entity was last updated
     * Automatically updated by TypeORM
     */
    @UpdateDateColumn({ type: 'timestamp' })
    updated_at: Date;

    /**
     * Reference to the user who last modified this entity
     * Used for audit trail
     */
    @Column({ type: 'uuid', nullable: true })
    modified_by: string;
}
