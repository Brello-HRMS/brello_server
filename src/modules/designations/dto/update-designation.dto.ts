import { PartialType } from '@nestjs/mapped-types';
import { CreateDesignationDto } from './create-designation.dto';

/**
 * Update Designation DTO
 *
 * All fields from CreateDesignationDto become optional here.
 *
 * Important: `code` and `org_id` are part of this DTO structure
 * but the service layer explicitly ignores them on update requests
 * to enforce the PRD rule: "code is immutable after creation".
 */
export class UpdateDesignationDto extends PartialType(CreateDesignationDto) { }
