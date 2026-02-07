import { PartialType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto';
import { OmitType } from '@nestjs/mapped-types';

/**
 * Update User DTO
 * 
 * Data Transfer Object for updating an existing user.
 * Extends CreateUserDto but excludes password (handled separately).
 * All fields are optional for partial updates.
 * 
 * Design Pattern: DTO Pattern + Open/Closed Principle
 * - Reuses validation rules from CreateUserDto
 * - Excludes password for security (use separate endpoint)
 * - All fields are optional for partial updates
 */
export class UpdateUserDto extends PartialType(
    OmitType(CreateUserDto, ['password'] as const),
) { }
