// TypeORM decorators for defining DB table structure and column metadata
import { Entity, Column, Index } from 'typeorm';

// BaseEntity provides shared fields across ALL entities in the system:
// id (UUID), organization_id, enterprise_id, status, code, description,
// created_at, updated_at, modified_by
// We extend it to avoid repeating these columns in every entity (DRY principle)
import { BaseEntity } from '../../../common/entities/base.entity';

/**
 * Department Entity
 *
 * Maps to the 'departments' table in the database.
 * Extends BaseEntity to inherit all common fields.
 *
 * WHY EXTEND BaseEntity?
 * - Every entity in this project shares the same standard columns
 * - Extending keeps the entity lean and consistent
 * - If a shared column changes (e.g., created_at precision), updating BaseEntity
 *   fixes it for ALL entities automatically
 */
@Entity('departments') // Tells TypeORM: this class maps to the 'departments' table
@Index(['organization_id', 'code'], { unique: true })
// WHY THIS INDEX?
// - A department code must be UNIQUE per organization (not globally)
// - Two different orgs CAN have the same code (e.g., both have "HR")
// - This composite unique index enforces that rule at the DB level
// - Also speeds up the duplicate-check query in DepartmentRepository.findByCode()
export class Department extends BaseEntity {

    /**
     * Full display name of the department (e.g., "Human Resources")
     *
     * WHY NOT IN BaseEntity?
     * - BaseEntity has `code` (short identifier) but not `name`
     * - name is department-specific and not needed on all entities
     */
    @Column({ type: 'varchar', length: 255 })
    // varchar(255): Standard string length; 255 is enough for any dept name
    name: string;

    /**
     * Optional department icon identifier
     *
     * WHY NULLABLE?
     * - Icon is optional per the PRD — departments can exist without one
     * - When null, the frontend should show a placeholder icon
     * - Storing the icon key (not the image itself) keeps the DB lightweight
     */
    @Column({ type: 'varchar', length: 255, nullable: true })
    icon: string;

    /**
     * Soft delete flag
     *
     * WHY SOFT DELETE (is_deleted) instead of actually deleting?
     * - Employee records that reference this department must remain valid
     * - Historical reports, analytics, and audits depend on past department data
     * - Compliance: deleted records must be traceable
     * - When is_deleted=true, the department is HIDDEN from all queries
     *   but still exists physically in the DB
     *
     * WHY DEFAULT FALSE?
     * - Every new department starts as "not deleted" — this is the safe default
     * - Explicit deletion only happens via the soft-delete service method
     */
    @Column({ type: 'boolean', default: false })
    is_deleted: boolean;
}
