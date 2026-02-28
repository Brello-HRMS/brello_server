// NestJS exception classes — thrown to send HTTP error responses automatically:
// - Injectable: marks class for Dependency Injection
// - NotFoundException: maps to HTTP 404 (resource not found)
// - BadRequestException: maps to HTTP 400 (invalid input / business rule violated)
// - ConflictException: maps to HTTP 409 (duplicate/conflict detected)
// - Logger: NestJS's built-in structured logger — used for audit trail and debugging
import {
    Injectable,
    NotFoundException,
    BadRequestException,
    ConflictException,
    Logger,
} from '@nestjs/common';

// The repository handles all raw DB queries — service never touches TypeORM directly
import { DepartmentRepository } from '../repositories/department.repository';

// UserService is imported here to resolve the user's organization_id from a userId
// WHY DO WE NEED THIS?
// The JWT token only contains userId + sessionId— it does NOT contain organization_id
// So we must look up the user record to find which org they belong to
import { UserService } from '../../user/services/user.service';

// DTOs type-check what comes in from the controller layer
import { CreateDepartmentDto } from '../dto/create-department.dto';
import { UpdateDepartmentDto } from '../dto/update-department.dto';
import { ListDepartmentsDto } from '../dto/list-departments.dto';

// Department entity: the TypeORM model returned from all service methods
import { Department } from '../entities/department.entity';

// Status enum: used to apply the default ACTIVE status when creating a department
import { Status } from '../../../common/enums';

/**
 * DepartmentService
 *
 * WHY A SEPARATE SERVICE LAYER?
 * - Service = Business Logic layer. All rules from the PRD pseudocode live here.
 * - Controller stays thin (just routing + HTTP plumbing)
 * - Repository stays focused on DB access only
 * - This separation makes each layer easier to test, debug, and replace independently
 *
 * RULES ENFORCED HERE:
 * 1. Department code must be unique within an organization
 * 2. Department code cannot be changed after creation
 * 3. Soft delete only (no physical deletion)
 * 4. All operations are scoped to the authenticated user's organization
 * 5. Audit logs on every create, update, delete
 */
@Injectable() // Registered in NestJS DI container — injected into DepartmentController
export class DepartmentService {

    // Logger: NestJS's built-in logger. Using a class-specific logger
    // makes it easy to grep logs by service name during debugging
    private readonly logger = new Logger(DepartmentService.name);

    constructor(
        private readonly departmentRepository: DepartmentRepository,
        // DepartmentRepository: injected to run all DB queries
        // WHY NOT INJECT TypeORM Repository DIRECTLY?
        // Repository pattern keeps SQL isolated; service stays db-agnostic

        private readonly userService: UserService,
        // UserService: needed to resolve organization_id from JWT's userId
        // WHY NOT PASS org_id FROM THE CLIENT?
        // Clients must NOT control which org they write to — this prevents cross-tenant attacks
    ) { }

    /**
     * Resolve the organization_id for a given userId
     *
     * WHY A PRIVATE METHOD?
     * - Every service method needs org_id — centralizing avoids repeating the logic
     * - If the lookup strategy changes (e.g., from DB to cache), only fix it here
     *
     * WHY THROW BadRequestException IF org NOT FOUND?
     * - A valid user must belong to an org — if they don't, something is wrong
     * - 400 is appropriate: the request can't be processed in this state
     */
    private async resolveOrgId(userId: string): Promise<string> {
        const user = await this.userService.findOne(userId);
        // findOne throws NotFoundException if user doesn't exist (covered by auth guard)

        if (!user || !user.organization_id) {
            // This state means the user exists but has no org — data integrity issue
            throw new BadRequestException(
                'User is not associated with any organization',
            );
        }
        return user.organization_id; // Return the org UUID for use in queries
    }

    /**
     * Create a new department
     *
     * BUSINESS RULES APPLIED (from PRD pseudocode):
     * Step 1: Auth — handled by JwtAuthGuard before hitting this method
     * Step 2: Permissions — JwtAuthGuard ensures only logged-in users proceed
     * Step 3: Validate input — class-validator handles this at the DTO layer
     * Step 4: Duplicate code check — done here with findByCode()
     * Step 5-6: Create + save — done in repository
     * Step 7: Audit log — done here with Logger
     * Step 8: Return — returns the created entity
     */
    async create(
        userId: string,                        // Authenticated user's ID (from JWT)
        createDepartmentDto: CreateDepartmentDto, // Validated input from request body
    ): Promise<Department> {
        this.logger.log(`User ${userId} is creating department: ${createDepartmentDto.code}`);
        // Logging at the START of each operation helps trace request flow when debugging

        // STEP 1: Get the user's organization (multi-tenant isolation)
        const organizationId = await this.resolveOrgId(userId);
        // organizationId is now the ONLY org this operation will touch

        // STEP 2: Check for duplicate department code within this organization
        // WHY NOT RELY ON DB UNIQUE CONSTRAINT ALONE?
        // - DB constraint throws a raw DB error (cryptic to debug and hard to format)
        // - Explicit check lets us throw a clean, human-readable ConflictException
        // - Provides a clear API error message back to the frontend
        const existing = await this.departmentRepository.findByCode(
            organizationId,
            createDepartmentDto.code,
        );
        if (existing) {
            // Throw 409 Conflict: semantic HTTP code for "resource already exists"
            throw new ConflictException(
                `Department with code '${createDepartmentDto.code}' already exists in this organization`,
            );
        }

        // STEP 3: Determine initial status
        // WHY USE nullish coalescing (??) instead of OR (||)?
        // - If status is explicitly set to Status.INACTIVE (a falsy-ish value in some cases),
        //   OR (||) would replace it with the default — wrong behavior
        // - Nullish coalescing only replaces null/undefined, preserving intentional values
        const status = createDepartmentDto.status ?? Status.ACTIVE;
        // Default: ACTIVE — most departments are created live and ready for use

        // STEP 4: Persist the new department
        const department = await this.departmentRepository.create({
            ...createDepartmentDto,     // Spread all validated DTO fields (code, name, description, icon)
            organization_id: organizationId, // Always link to the user's own org — never from client
            status,                     // Apply default or provided status
            is_deleted: false,          // Explicit default: new departments are never deleted
            modified_by: userId,        // Audit trail: record WHO created this
        });

        // STEP 5: Audit log — who did what and when
        // WHY LOG AFTER SAVE (not before)?
        // - We log once we KNOW the save succeeded (has a real ID)
        // - Logging before save means we might log an operation that failed
        this.logger.log(
            `[AUDIT] Department created | id=${department.id} | code=${department.code} | org=${organizationId} | by=${userId}`,
        );
        // Format: [AUDIT] prefix makes audit entries easy to grep from log files

        return department; // Return full department object to the controller
    }

    /**
     * List all departments for the authenticated user's organization
     *
     * WHY PASS userId AND LET SERVICE RESOLVE ORG?
     * - If we passed orgId from the controller, a client could forge any orgId
     * - userId → service → DB lookup → orgId is the secure, server-side flow
     */
    async findAll(
        userId: string,          // Authenticated user — used to resolve org
        filters: ListDepartmentsDto, // Optional: status, search, sort_by, sort_order
    ): Promise<Department[]> {
        this.logger.log(`User ${userId} is listing departments`);
        // Log the user so we can trace who is accessing the list endpoint

        const organizationId = await this.resolveOrgId(userId);
        // Resolve org once — all subsequent logic uses this locked value

        return this.departmentRepository.findAllByOrg(organizationId, filters);
        // Delegate the actual query (with filtering/sorting) to the repository
        // The repository ensures is_deleted: false is always applied
    }

    /**
     * Fetch a single department by ID
     *
     * WHY PASS BOTH id AND userId (not just id)?
     * - An authenticated user from Org A must NOT be able to read Org B's departments
     * - The repository adds organization_id to the WHERE clause — blocking cross-org access
     * - If ID exists but belongs to another org → 404 (not "403 Forbidden")
     *   WHY 404 INSTEAD OF 403? Security best practice: don't reveal that the resource
     *   EXISTS at all — just say "not found"
     */
    async findOne(userId: string, id: string): Promise<Department> {
        this.logger.log(`User ${userId} is fetching department: ${id}`);

        const organizationId = await this.resolveOrgId(userId);

        const department = await this.departmentRepository.findOneByOrg(
            id,
            organizationId, // Security: repository adds this to the WHERE clause
        );

        if (!department) {
            // Throw 404 — department doesn't exist, is deleted, or belongs to a different org
            // All three cases look the same to the client (security: no leaking org structure)
            throw new NotFoundException(`Department with ID '${id}' not found`);
        }

        return department; // Return the found department to the controller
    }

    /**
     * Update allowed fields of an existing department
     *
     * KEY RULE: Department code is IMMUTABLE (cannot be changed after creation)
     *
     * HOW IS IMMUTABILITY ENFORCED?
     * Layer 1: UpdateDepartmentDto doesn't include `code` — client can't even send it
     * Layer 2: The spread `...safeUpdate` below only contains dto fields — no `code`
     * Layer 3 (safety): Even if somehow `code` arrives here, it won't be in safeUpdate
     */
    async update(
        userId: string,                        // Authenticated user — for auth and audit
        id: string,                            // UUID of the department to update
        updateDepartmentDto: UpdateDepartmentDto, // Only updatable fields (no code)
    ): Promise<Department> {
        this.logger.log(`User ${userId} is updating department: ${id}`);

        // STEP 1: Verify the department exists in this user's org BEFORE updating
        // WHY? findOne() also checks org-scope — prevents updating another org's department
        // If not found → throws NotFoundException (no silent failure)
        await this.findOne(userId, id);

        // STEP 2: Build the safe update payload
        // WHY DESTRUCTURE INTO safeUpdate?
        // - Future safety: If someone accidentally adds `code` to UpdateDepartmentDto,
        //   we can explicitly exclude it here (e.g., const { code, ...safeUpdate } = dto)
        // - Currently UpdateDepartmentDto doesn't have `code`, so this is already safe
        const { ...safeUpdate } = updateDepartmentDto;

        const updated = await this.departmentRepository.update(id, {
            ...safeUpdate,      // Apply only the valid update fields from the DTO
            modified_by: userId, // Audit trail: record WHO made this change
            // WHY UPDATE modified_by ON EVERY UPDATE?
            // Answers "who last touched this record?" — critical for debugging data issues
        });

        if (!updated) {
            // This case is extremely rare (update succeeded but findOne returned null)
            // Could indicate concurrent deletion — we surface it as 404
            throw new NotFoundException(
                `Department with ID '${id}' not found after update`,
            );
        }

        // Audit log: record what changed and who changed it
        this.logger.log(
            `[AUDIT] Department updated | id=${id} | by=${userId} | fields=${Object.keys(safeUpdate).join(', ')}`,
        );
        // Object.keys(safeUpdate) tells us WHICH fields were updated — helpful for debugging

        return updated; // Return the freshly updated record
    }

    /**
     * Soft-delete a department
     *
     * WHY "SOFT" DELETE?
     * - Employee records linked to this department must stay intact (historical data)
     * - Payroll, performance reviews, audit logs all reference the department
     * - Physical deletion would break referential integrity and violate compliance
     *
     * WHAT SOFT DELETE DOES:
     * - Sets is_deleted = true → department is hidden from ALL queries
     * - Sets status = INACTIVE → signals "don't allow new employee assignments"
     * - Record stays in DB forever (invisible to users, visible in raw DB queries)
     */
    async remove(userId: string, id: string): Promise<void> {
        this.logger.log(`User ${userId} is soft-deleting department: ${id}`);

        // STEP 1: Verify department exists in this user's org BEFORE deleting
        // WHY? Prevents deleting another org's department (cross-tenant attack)
        // Also prevents deleting an already-deleted department (idempotency protection)
        await this.findOne(userId, id);

        // TODO (Phase 2): Block deletion if active employees are assigned to this department
        // HOW IT WILL WORK:
        // const activeEmployeeCount = await this.employeeRepository.countByDepartment(id);
        // if (activeEmployeeCount > 0) {
        //   throw new BadRequestException(
        //     'Cannot delete department with active employees. Reassign them first.',
        //   );
        // }
        // WHY PHASE 2? The Employee module doesn't exist yet.
        // When built, import EmployeeRepository and inject it into this service.

        // STEP 2: Perform the soft delete
        await this.departmentRepository.softDelete(id);
        // softDelete() sets: is_deleted = true AND status = INACTIVE (double safety)

        // Audit log: record who deleted what and when
        this.logger.log(
            `[AUDIT] Department soft-deleted | id=${id} | by=${userId}`,
        );
        // No return value needed — controller sends 204 No Content on success
    }
}
