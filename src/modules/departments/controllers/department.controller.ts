// NestJS HTTP decorators for routing and HTTP method/status handling
import {
    Controller,      // Marks this class as an HTTP controller + sets the route prefix
    Get,             // Maps to HTTP GET
    Post,            // Maps to HTTP POST
    Body,            // Extracts + validates the request body via DTO
    Patch,           // Maps to HTTP PATCH (partial update)
    Param,           // Extracts a route URL parameter (e.g., :id)
    Delete,          // Maps to HTTP DELETE
    HttpCode,        // Overrides the default HTTP status code for a route
    HttpStatus,      // Enum of standard HTTP status codes (e.g., 201, 200, 204)
    ParseUUIDPipe,   // Validates that a URL param is a valid UUID before reaching the handler
    UseGuards,       // Applies one or more guards to a route or controller
    Query,           // Extracts and validates query string parameters
} from '@nestjs/common';

// The service layer — all business logic lives here, NOT in the controller
import { DepartmentService } from '../services/department.service';

// DTOs: define what the request body/query must look like (validated automatically)
import { CreateDepartmentDto } from '../dto/create-department.dto';
import { UpdateDepartmentDto } from '../dto/update-department.dto';
import { ListDepartmentsDto } from '../dto/list-departments.dto';

// JwtAuthGuard: protects every route — unauthenticated requests are rejected with 401
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

// CurrentUser: custom decorator that extracts the user from the JWT-decoded request.user
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

// `import type` is REQUIRED here due to tsconfig: isolatedModules=true + emitDecoratorMetadata=true
// WHY import type AND NOT import?
// - JwtPayload is an interface (type-only), not a class or value
// - With isolatedModules, TypeScript can't emit metadata for interfaces unless imported as type
// - The auth controller uses the same pattern (see auth.controller.ts line 16)
import type { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';

/**
 * DepartmentController
 *
 * WHY IS THE CONTROLLER "THIN"?
 * - This controller has NO business logic — it just:
 *   1. Receives the HTTP request
 *   2. Extracts and validates parameters
 *   3. Passes them to the service
 *   4. Returns the service result as the HTTP response
 * - All rules (duplicate check, soft delete logic, etc.) live in DepartmentService
 * - This makes it easy to swap HTTP with gRPC/GraphQL without changing any business logic
 *
 * AUTHENTICATION:
 * - @UseGuards(JwtAuthGuard) is applied at CLASS level → ALL routes are protected
 * - No route in this controller is publicly accessible
 * - Guard runs BEFORE the route handler — unauthenticated requests never reach the method
 */
@Controller('departments')    // All routes in this class start with /departments
@UseGuards(JwtAuthGuard)      // ALL routes require a valid JWT — applied at class level for DRY
export class DepartmentController {

    constructor(private readonly departmentService: DepartmentService) {
        // DepartmentService is injected — controller never directly queries the DB
    }

    /**
     * POST /departments
     * Creates a new department in the authenticated user's organization
     *
     * WHY @HttpCode(HttpStatus.CREATED)?
     * - Default for POST in NestJS is 201, but being explicit avoids confusion
     * - 201 = Created: semantic HTTP status for successful resource creation
     *
     * FLOW:
     * 1. JwtAuthGuard validates the Bearer token → 401 if missing/invalid
     * 2. @Body() validates the request body via CreateDepartmentDto → 400 if invalid
     * 3. @CurrentUser() extracts userId from the decoded JWT (set by JwtStrategy)
     * 4. Service creates the department under the user's org, checks for duplicates
     * 5. Returns the created department object
     */
    @Post()
    @HttpCode(HttpStatus.CREATED) // 201: resource successfully created
    create(
        @CurrentUser() user: JwtPayload,          // Extract authenticated user from JWT
        @Body() createDepartmentDto: CreateDepartmentDto, // Validate + extract request body
    ) {
        // Pass only userId — org is resolved server-side (client can't forge org)
        return this.departmentService.create(user.userId, createDepartmentDto);
    }

    /**
     * GET /departments
     * Lists all departments for the authenticated user's org
     * Supports optional query params: ?status=ACTIVE&search=eng&sort_by=name&sort_order=ASC
     *
     * WHY @Query() with a DTO?
     * - @Query() without a type would return a plain `Record<string, string>` (unsafe)
     * - Using ListDepartmentsDto with class-validator auto-validates query params
     * - Invalid values (e.g., ?sort_by=hack) return 400 before reaching the service
     */
    @Get()
    @HttpCode(HttpStatus.OK) // 200: successful read operation
    findAll(
        @CurrentUser() user: JwtPayload,   // Needed to resolve the user's organization
        @Query() filters: ListDepartmentsDto, // Optional query params (all validated by DTO)
    ) {
        return this.departmentService.findAll(user.userId, filters);
    }

    /**
     * GET /departments/:id
     * Fetches a single department by UUID within the user's org
     *
     * WHY ParseUUIDPipe ON :id?
     * - Without it, any string (e.g., "delete-all") would reach the service
     * - ParseUUIDPipe rejects non-UUID values with 400 BEFORE any DB query runs
     * - Prevents garbage values from causing unexpected errors in the repository
     *
     * WHY RETURN 404 FOR CROSS-ORG ACCESS (not 403)?
     * - Returning 404 hides that the resource exists at all
     * - If we returned 403, an attacker would know the UUID is valid
     */
    @Get(':id')
    @HttpCode(HttpStatus.OK) // 200: department found and returned
    findOne(
        @CurrentUser() user: JwtPayload,         // Used to resolve org and scope the query
        @Param('id', ParseUUIDPipe) id: string,  // Validates UUID format, then extracts value
    ) {
        return this.departmentService.findOne(user.userId, id);
    }

    /**
     * PATCH /departments/:id
     * Updates allowed fields of an existing department
     *
     * WHY PATCH AND NOT PUT?
     * - PATCH = partial update: client sends only fields being changed
     * - PUT = full replace: client sends ALL fields (even unchanged ones)
     * - PATCH is safer and more efficient — no risk of accidentally blanking fields
     *
     * CODE IMMUTABILITY:
     * - UpdateDepartmentDto does NOT include `code`
     * - Even if the client sends `code` in the body, class-transformer strips it
     * - Service layer also omits it as a defense-in-depth measure
     */
    @Patch(':id')
    @HttpCode(HttpStatus.OK) // 200: department updated and returned
    update(
        @CurrentUser() user: JwtPayload,             // For org scoping and audit log
        @Param('id', ParseUUIDPipe) id: string,      // UUID validated before reaching service
        @Body() updateDepartmentDto: UpdateDepartmentDto, // Only valid update fields
    ) {
        return this.departmentService.update(user.userId, id, updateDepartmentDto);
    }

    /**
     * DELETE /departments/:id
     * Soft-deletes a department (sets is_deleted=true, status=INACTIVE)
     *
     * WHY 204 NO CONTENT?
     * - Standard HTTP semantics: successful delete returns no response body
     * - 204 tells the client the action succeeded with nothing to send back
     * - The service returns void — no entity to serialize
     *
     * WHY SOFT DELETE (not physical)?
     * - Employee records referencing this department must remain valid
     * - Historical data and compliance require the record to persist
     * - is_deleted=true makes the department invisible without removing it from DB
     */
    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT) // 204: deleted successfully, no response body
    remove(
        @CurrentUser() user: JwtPayload,        // For org scoping, auth, and audit log
        @Param('id', ParseUUIDPipe) id: string, // UUID validated before reaching service
    ) {
        return this.departmentService.remove(user.userId, id);
        // Service throws 404 if not found, 400 if active employees block deletion (Phase 2)
    }
}
