import {
    IsString,
    IsNotEmpty,
    IsOptional,
    IsUUID,
    IsEnum,
    MaxLength,
} from 'class-validator';
import { Status } from '../../../common/enums/status.enum';

/**
 * Create Designation DTO
 *
 * Validates the request body when creating a new designation.
 * All constraints mirror the PRD specification.
 */
export class CreateDesignationDto {
    // The organization this designation belongs to (required)
    @IsUUID('4', { message: 'org_id must be a valid UUID' })
    @IsNotEmpty({ message: 'org_id is required' })
    org_id: string;

    // Optional department linkage — must belong to the same org (validated in service)
    @IsUUID('4', { message: 'department_id must be a valid UUID' })
    @IsOptional()
    department_id?: string;

    /**
     * Short, unique designation code within the organization.
     * Immutable after creation.
     * Examples: "SWE", "PM", "HR-LEAD"
     */
    @IsString()
    @IsNotEmpty({ message: 'Designation code is required' })
    @MaxLength(50, { message: 'Code must be at most 50 characters' })
    code: string;

    // Full designation title — must not be empty
    @IsString()
    @IsNotEmpty({ message: 'Designation title is required' })
    @MaxLength(255, { message: 'Title must be at most 255 characters' })
    title: string;

    // Optional seniority level — e.g. "L1", "L2", "Senior"
    @IsString()
    @IsOptional()
    @MaxLength(50, { message: 'Level must be at most 50 characters' })
    level?: string;

    // Status of the designation; defaults to ACTIVE if not provided
    @IsEnum(Status, { message: 'status must be a valid Status value' })
    @IsOptional()
    status?: Status;

    // Optional free-text description
    @IsString()
    @IsOptional()
    description?: string;
}
