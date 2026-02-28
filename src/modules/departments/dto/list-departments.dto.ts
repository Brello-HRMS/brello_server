// class-validator decorators for validating query parameters
import { IsOptional, IsEnum, IsString, IsIn } from 'class-validator';

// Status enum: restrict filter to only valid department statuses
import { Status } from '../../../common/enums';

/**
 * ListDepartmentsDto
 *
 * Data Transfer Object for query parameters when listing departments.
 * Every field is optional — passing no params returns all active departments.
 *
 * WHY A SEPARATE DTO FOR LISTING?
 * - Query params need their own validation (different rules from body DTOs)
 * - Makes the controller signature explicit and self-documenting
 * - Prevents unknown/dangerous query params from reaching the repository layer
 *
 * HOW IT'S USED:
 * GET /departments?status=ACTIVE&search=eng&sort_by=name&sort_order=ASC
 * NestJS + class-validator validates this automatically when used with @Query()
 */
export class ListDepartmentsDto {

    /**
     * Filter by department status
     *
     * WHY @IsEnum?
     * - Without this, a client could send ?status=DELETED and see soft-deleted records
     * - IsEnum rejects any value not in the Status enum
     * - Only ACTIVE and INACTIVE are meaningful for filtering; DELETED is hidden by is_deleted flag
     */
    @IsEnum(Status, { message: 'Status must be a valid Status value' })
    @IsOptional() // Omitting this param returns all statuses (both ACTIVE and INACTIVE)
    status?: Status;

    /**
     * Search keyword — matches against department name OR code
     *
     * WHY SEARCH BOTH NAME AND CODE?
     * - HR admins may search by the short code ("HR") or full name ("Human Resources")
     * - Searching both improves discoverability without requiring exact knowledge
     * - Implemented as SQL ILIKE (case-insensitive) in the repository layer
     */
    @IsString()   // Must be a plain string (prevents object/array injection)
    @IsOptional() // No search = return all departments (no text filter applied)
    search?: string;

    /**
     * Which field to sort results by
     *
     * WHY ONLY 'name' OR 'created_at'?
     * - These are the two most useful sort fields per the PRD
     * - Allowing arbitrary sort fields is a security risk (SQL injection vector)
     * - IsIn() whitelist prevents sorting by sensitive internal fields like 'organization_id'
     */
    @IsString()
    @IsIn(['name', 'created_at'], { message: 'sort_by must be name or created_at' })
    // IsIn acts as a whitelist — ONLY these two values are accepted
    @IsOptional()
    sort_by?: 'name' | 'created_at';

    /**
     * Sort direction — ascending or descending
     *
     * WHY DEFAULT TO DESC IN REPOSITORY?
     * - Most recent departments are shown first by default (created_at DESC)
     * - Matches user expectation: newest entries appear at the top
     * - Default is applied in the repository, not here — DTO just validates
     */
    @IsString()
    @IsIn(['ASC', 'DESC'], { message: 'sort_order must be ASC or DESC' })
    // IsIn whitelist prevents arbitrary SQL keywords from reaching the query builder
    @IsOptional()
    sort_order?: 'ASC' | 'DESC';
}
