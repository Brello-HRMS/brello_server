// class-validator decorators: validate incoming request body before it reaches the service
// This protects the service layer from bad/malicious input
import {
    IsString,      // Ensures the value is a plain string
    IsNotEmpty,    // Ensures the value is not an empty string or undefined
    IsOptional,    // Makes the field optional (won't error if missing)
    IsEnum,        // Validates against a fixed enum of allowed values
    Length,        // Enforces min/max string length
    Matches,       // Validates against a regex pattern
} from 'class-validator';

// Status enum: defines allowed department statuses (ACTIVE, INACTIVE, etc.)
// Imported from common so this same enum is reused across ALL modules
import { Status } from '../../../common/enums';

/**
 * CreateDepartmentDto
 *
 * Data Transfer Object for creating a new department.
 *
 * WHY A DTO?
 * - Acts as a contract between the HTTP layer and the service layer
 * - Decorators here run BEFORE the service, so invalid data never reaches business logic
 * - Provides clear API documentation for frontend/Postman users
 *
 * WHY NOT INCLUDE org_id HERE?
 * - Clients must NOT be able to create departments for OTHER organizations
 * - org_id is resolved server-side from the authenticated user's JWT token
 * - This prevents cross-tenant data injection attacks
 */
export class CreateDepartmentDto {

    /**
     * Department short code (e.g., "HR", "ENG", "FIN")
     *
     * WHY UPPERCASE ALPHANUMERIC ONLY?
     * - Codes are used in reports, analytics, and system integrations
     * - Consistent casing prevents duplicates like "hr" and "HR"
     * - Special characters cause issues in CSV exports and URL params
     *
     * WHY MAX 50 CHARS?
     * - Matches the BaseEntity `code` column length (varchar 50)
     * - Short codes are easier to read in dropdowns and reports
     *
     * WHY REQUIRED (IsNotEmpty)?
     * - Every department must have a code — it's the business identifier
     * - Without code, duplicate detection and integrations break
     */
    @IsString()           // Must be a string, not a number or object
    @IsNotEmpty({ message: 'Department code is required' }) // Reject empty string or whitespace
    @Length(1, 50, { message: 'Code must be between 1 and 50 characters' }) // Match DB column length
    @Matches(/^[A-Z0-9_-]+$/, {
        message: 'Code must be uppercase alphanumeric (A-Z, 0-9, -, _)',
        // WHY THIS REGEX? Strict format ensures consistency across all departments
        // and prevents code injection or ambiguous identifiers
    })
    code: string;

    /**
     * Full display name of the department (e.g., "Human Resources")
     *
     * WHY MIN LENGTH 2?
     * - Single-character names like "A" are meaningless and likely input errors
     * - Ensures names are descriptive enough to be useful in the UI
     */
    @IsString()
    @IsNotEmpty({ message: 'Department name is required' })
    @Length(2, 255, { message: 'Name must be between 2 and 255 characters' })
    // 255 max matches the DB column length — prevents truncation errors on save
    name: string;

    /**
     * Optional long description of the department
     *
     * WHY @IsOptional?
     * - PRD specifies description is optional
     * - If not sent, the entity saves null (acceptable, column is nullable in DB)
     */
    @IsString()
    @IsOptional()
    description?: string;

    /**
     * Optional icon identifier from the icon factory
     *
     * WHY STORE IDENTIFIER NOT THE IMAGE?
     * - Images are served by the frontend icon factory
     * - Storing the key (e.g., "icon-building") keeps the DB lightweight
     * - Easy to change displayed icon without a DB migration
     */
    @IsString()
    @IsOptional()
    icon?: string;

    /**
     * Initial status of the department — defaults to ACTIVE if not provided
     *
     * WHY @IsOptional with a default?
     * - Most departments are created Active — reducing required input for users
     * - Allows creating an Inactive department upfront if needed (pre-planning)
     * - Default is applied at the SERVICE layer, not here (DTO doesn't set defaults)
     */
    @IsEnum(Status, { message: 'Status must be ACTIVE or INACTIVE' })
    // IsEnum rejects any value outside the Status enum — prevents garbage data
    @IsOptional()
    status?: Status;
}
