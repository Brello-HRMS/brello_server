import { PartialType } from '@nestjs/mapped-types';
import { CreateEnterpriseDto } from './create-enterprise.dto';

/**
 * Update Enterprise DTO
 * 
 * Data Transfer Object for updating an existing enterprise.
 * Extends CreateEnterpriseDto with all fields optional.
 * 
 * Design Pattern: DTO Pattern + Open/Closed Principle
 * - Reuses validation rules from CreateEnterpriseDto
 * - All fields are optional for partial updates
 * - Closed for modification, open for extension
 */
export class UpdateEnterpriseDto extends PartialType(CreateEnterpriseDto) { }
