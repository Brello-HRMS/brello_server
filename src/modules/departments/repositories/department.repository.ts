// @nestjs/common: NestJS DI decorator — marks this class as injectable
import { Injectable } from '@nestjs/common';

// @nestjs/typeorm: Bridge between NestJS DI and TypeORM's Repository
import { InjectRepository } from '@nestjs/typeorm';

// TypeORM utilities:
// - Repository: Base class with CRUD methods (find, save, update, delete)
// - FindManyOptions: Typed options object for find() calls (where, order, etc.)
// - ILike: Case-insensitive LIKE operator — used for name/code search
import { Repository, FindManyOptions, ILike } from 'typeorm';

// The entity this repository manages
import { Department } from '../entities/department.entity';

// ListDepartmentsDto contains optional filters (status, search, sort)
// We use it here to type the filter parameter in findAllByOrg()
import { ListDepartmentsDto } from '../dto/list-departments.dto';

// Status enum: used in softDelete() to set status = INACTIVE
import { Status } from '../../../common/enums';

/**
 * DepartmentRepository
 *
 * WHY A SEPARATE REPOSITORY CLASS (not just using TypeORM's generic Repository)?
 * - Repository Pattern: isolates all database access in one place
 * - Service layer stays clean — it calls named methods, not raw TypeORM queries
 * - Easier to mock in unit tests (swap real repo for a fake one)
 * - If we switch from TypeORM to Prisma/Knex, only this file changes
 */
@Injectable() // Must be injectable so NestJS can inject it into DepartmentService
export class DepartmentRepository {

    constructor(
        @InjectRepository(Department)
        // @InjectRepository(Department): Tells NestJS DI to inject the TypeORM
        // Repository<Department> instance. TypeOrmModule.forFeature([Department])
        // in the module makes this available.
        private readonly repository: Repository<Department>,
    ) { }

    /**
     * Create and persist a new department record in the database
     *
     * WHY TWO STEPS (create + save) instead of repository.insert()?
     * - repository.create() builds the entity object in memory (triggers lifecycle hooks)
     * - repository.save() executes the INSERT and returns the entity with generated ID
     * - insert() is faster but doesn't return the entity or trigger hooks
     */
    async create(data: Partial<Department>): Promise<Department> {
        const department = this.repository.create(data); // Build entity in memory
        return this.repository.save(department);         // INSERT into DB, return with ID
    }

    /**
     * Find all departments for a given organization, with optional filtering,
     * search, and sorting. Soft-deleted records are always excluded.
     *
     * WHY ALWAYS FILTER is_deleted: false?
     * - Soft-deleted departments should be invisible to end users
     * - Every query must exclude them — this is the single place that enforces it
     *
     * WHY ILike FOR SEARCH?
     * - ILike = case-insensitive LIKE — searches for "eng" find "Engineering" too
     * - Regular `Like` would miss uppercase/lowercase mismatches
     *
     * WHY TWO whereConditions WHEN SEARCHING?
     * - TypeORM's `where: [condA, condB]` applies OR logic between array elements
     * - We want: WHERE (name ILIKE '%search%') OR (code ILIKE '%search%')
     * - Separate objects in the array achieve this — merging them into one object
     *   would give AND logic (both conditions must match, which is wrong)
     */
    async findAllByOrg(
        organizationId: string,   // Only return departments from this org (multi-tenant isolation)
        filters: ListDepartmentsDto = {}, // All filters are optional
    ): Promise<Department[]> {
        const {
            status,
            search,
            sort_by = 'created_at', // Default: sort by when created (newest first)
            sort_order = 'DESC',     // Default: newest records first
        } = filters;

        // WHY 'as' CAST?
        // TypeScript narrows FindManyOptions<Department>['where'] to a complex union type.
        // The cast tells TypeScript we know what we are doing here.
        const whereConditions: FindManyOptions<Department>['where'] = [];

        // Base condition applied to EVERY query variant:
        // - organization_id: ensures cross-org data leakage is impossible
        // - is_deleted: false: ensures soft-deleted records never appear
        // - status spread: only applied if a status filter was provided
        const base = {
            organization_id: organizationId, // Multi-tenant isolation: only this org's data
            is_deleted: false,               // NEVER return soft-deleted departments
            ...(status ? { status } : {}),   // Conditionally add status filter if provided
        };

        if (search) {
            // SEARCH MODE: Match name OR code (case-insensitive)
            // Array of conditions = TypeORM OR logic
            whereConditions.push(
                { ...base, name: ILike(`%${search}%`) }, // Match "search" anywhere in name
                { ...base, code: ILike(`%${search}%`) }, // OR anywhere in code
            );
        } else {
            // NO SEARCH: Return all departments matching the base condition
            whereConditions.push(base);
        }

        return this.repository.find({
            where: whereConditions, // Apply the built conditions
            order: { [sort_by]: sort_order }, // Dynamic sort field and direction
            // Dynamic property key: sort_by is either 'name' or 'created_at'
            // TypeScript computed property syntax [] handles this cleanly
        });
    }

    /**
     * Find a single department by ID, scoped to an organization
     *
     * WHY ALSO CHECK organization_id HERE?
     * - A malicious user could guess another org's department UUID and fetch it
     * - Adding organization_id to the WHERE clause makes that impossible
     * - If ID matches but org doesn't → returns null → service throws 404
     * - This is the second line of defense after JWT auth
     *
     * WHY CHECK is_deleted: false?
     * - Soft-deleted departments must be invisible — even if you know the UUID
     */
    async findOneByOrg(
        id: string,             // UUID of the department to find
        organizationId: string, // Must match the authenticated user's org
    ): Promise<Department | null> {
        return this.repository.findOne({
            where: {
                id,                              // Match this specific department
                organization_id: organizationId, // Only from this org (security check)
                is_deleted: false,               // Exclude soft-deleted departments
            },
        });
    }

    /**
     * Check if a department code already exists in the organization
     *
     * WHY THIS METHOD EXISTS (not just using findOneByOrg)?
     * - Duplicate check runs at CREATE time, before the department has an ID
     * - This specifically searches by code+org combination
     * - Called before insert to enforce the "unique code per org" business rule
     * - Faster than findAll + filter in application code (single DB query)
     *
     * WHY CHECK is_deleted: false?
     * - A soft-deleted department's code should be RECLAIMABLE
     *   (another department can reuse the code after the old one is deleted)
     * - If we didn't filter, a deleted "ENG" would prevent a new "ENG" forever
     */
    async findByCode(
        organizationId: string, // Only check within this org (codes are org-scoped)
        code: string,           // The code to check for duplicates
    ): Promise<Department | null> {
        return this.repository.findOne({
            where: {
                organization_id: organizationId, // Scoped to org — two orgs CAN share codes
                code,                            // The specific code being checked
                is_deleted: false,               // Ignore deleted depts — their code is reusable
            },
        });
    }

    /**
     * Update a department's fields and return the updated record
     *
     * WHY TWO STEPS (update + findOne) instead of repository.save()?
     * - repository.update() issues a targeted SQL UPDATE WHERE id=... (efficient)
     * - repository.save() would load the entity first, then save all fields (overhead)
     * - After update(), we re-fetch to return the fresh record to the caller
     *
     * WHY RETURN null POSSIBILITY?
     * - If the update somehow fails silently (ID not found), findOne returns null
     * - The service handles this case by throwing a NotFoundException
     */
    async update(
        id: string,                      // The department to update
        updateData: Partial<Department>, // Only the fields being changed (partial update)
    ): Promise<Department | null> {
        await this.repository.update(id, updateData); // Execute SQL UPDATE
        return this.repository.findOne({ where: { id } }); // Re-fetch and return fresh record
    }

    /**
     * Soft-delete a department
     *
     * WHY NOT repository.delete()?
     * - Physical deletion would orphan historical records (employee assignments, reports)
     * - Regulatory/compliance: records must be preserved even after "deletion"
     * - Soft delete = mark as hidden, never remove from DB
     *
     * WHY SET BOTH is_deleted AND status?
     * - is_deleted: true → hides from all queries
     * - status: INACTIVE → signals to employee-assignment logic: no new assignments
     * - Both must be set for the rule "Inactive departments cannot be assigned" to work
     *   even if someone queries by status without filtering is_deleted
     */
    async softDelete(id: string): Promise<void> {
        await this.repository.update(id, {
            is_deleted: true,        // Mark as hidden — primary soft-delete flag
            status: Status.INACTIVE, // Mark as inactive — secondary signal for business rules
        });
        // No return value needed — the service checks success via findOne before calling this
    }

    /**
     * Count total active (non-deleted) departments for an organization
     *
     * WHY THIS METHOD?
     * - Used for metrics: "Total departments per org" (PRD Section 9)
     * - count() is more efficient than findAll().length (no data transfer)
     * - Can be exposed via a reporting or analytics endpoint in the future
     */
    async countByOrg(organizationId: string): Promise<number> {
        return this.repository.count({
            where: {
                organization_id: organizationId, // Only for this org
                is_deleted: false,               // Exclude soft-deleted departments
            },
        });
    }
}
