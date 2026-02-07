import { PartialType } from '@nestjs/mapped-types';
import { CreateOrganizationDto } from './create-organization.dto';

/**
 * Update Organization DTO
 * 
 * Data Transfer Object for updating an existing organization.
 * Extends CreateOrganizationDto with all fields optional.
 * 
 * Design Pattern: DTO Pattern + Open/Closed Principle
 * - Reuses validation rules from CreateOrganizationDto
 * - All fields are optional for partial updates
 */
export class UpdateOrganizationDto extends PartialType(
    CreateOrganizationDto,
) { }
