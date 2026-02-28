// class-validator decorators for request body validation
import { IsString, IsOptional, IsEnum, Length } from 'class-validator';

// Status enum shared across all modules — ensures only valid statuses are accepted
import { Status } from '../../../common/enums';

/**
 * UpdateDepartmentDto
 *
 * Data Transfer Object for updating an existing department.
 *
 * CRITICAL DESIGN DECISION — WHY IS `code` MISSING FROM THIS DTO?
 * - The department `code` is IMMUTABLE after creation (per business rules in the PRD)
 * - Code is used in external reports, analytics, integrations, and historical data
 * - Changing it would break historical employee records and system integrations
 * - By simply NOT including `code` in this DTO, it's impossible to pass it
 *   from the HTTP layer — even if a client sends `code` in the request body,
 *   it will be stripped during DTO validation (class-transformer whitelist mode)
 *
 * WHY ALL FIELDS ARE @IsOptional?
 * - PATCH semantics: partial updates are allowed (not a full replace like PUT)
 * - Client can update just the name, or just the status, without resending all fields
 * - Service layer applies only the fields that were actually sent
 */
export class UpdateDepartmentDto {

    /**
     * Updated full display name
     *
     * WHY SAME VALIDATION AS CREATE?
     * - Same DB column constraints apply — length must stay within 2-255 chars
     * - Prevents empty name updates that would break the UI display
     */
    @IsString()       // Must be a string if provided
    @IsOptional()     // Fine to omit if only updating other fields
    @Length(2, 255, { message: 'Name must be between 2 and 255 characters' })
    name?: string;

    /**
     * Updated status (ACTIVE / INACTIVE)
     *
     * WHY ALLOW STATUS UPDATE HERE?
     * - Admin needs to deactivate/reactivate departments without full deletion
     * - Setting INACTIVE warns future employee-assignment logic to block new assignments
     * - Setting back to ACTIVE re-enables the department for assignments
     */
    @IsEnum(Status, { message: 'Status must be ACTIVE or INACTIVE' })
    // IsEnum prevents invalid values like "ENABLED" or "1" from reaching the DB
    @IsOptional()
    status?: Status;

    /**
     * Updated description text
     *
     * WHY NO LENGTH LIMIT?
     * - DB column is `text` type (unlimited length) — no constraint to enforce
     * - Descriptions can be long paragraphs explaining the department's purpose
     */
    @IsString()
    @IsOptional()
    description?: string;

    /**
     * Updated icon identifier
     *
     * WHY ALLOW ICON UPDATES?
     * - Organizations may want to rebrand department icons over time
     * - This is purely cosmetic and doesn't affect any business logic
     */
    @IsString()
    @IsOptional()
    icon?: string;
}
