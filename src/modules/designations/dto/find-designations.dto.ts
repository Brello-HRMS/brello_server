import { IsOptional, IsString, IsUUID, IsEnum } from 'class-validator';
import { Status } from '../../../common/enums/status.enum';

/**
 * Find Designations DTO
 *
 * Optional query parameters for listing designations within an org.
 * Supports server-side search, status filtering, and department filtering.
 */
export class FindDesignationsDto {
    // Full-text search across designation title and code
    @IsString()
    @IsOptional()
    search?: string;

    // Filter by lifecycle status (Active / Inactive)
    @IsEnum(Status, { message: 'status must be a valid Status value' })
    @IsOptional()
    status?: Status;

    // Filter designations by a specific department within the org
    @IsUUID('4', { message: 'department_id must be a valid UUID' })
    @IsOptional()
    department_id?: string;
}
