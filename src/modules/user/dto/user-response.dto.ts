import { Exclude, Expose } from 'class-transformer';

/**
 * User Response DTO
 * 
 * Data Transfer Object for user responses.
 * Controls what data is exposed to API consumers.
 * Excludes sensitive fields like password_hash.
 * 
 * Design Pattern: DTO Pattern
 * - Separates internal representation from external API contract
 * - Prevents accidental exposure of sensitive data
 * - Uses class-transformer for automatic transformation
 */
@Exclude()
export class UserResponseDto {
    @Expose()
    id: string;

    @Expose()
    first_name: string;

    @Expose()
    middle_name: string;

    @Expose()
    last_name: string;

    @Expose()
    email: string;

    @Expose()
    phone: string;

    @Expose()
    enterprise_id: string;

    @Expose()
    organization_id: string;

    @Expose()
    status: string;

    @Expose()
    code: string;

    @Expose()
    description: string;

    @Expose()
    created_at: Date;

    @Expose()
    updated_at: Date;

    @Expose()
    modified_by: string;

    // password_hash is NOT exposed - excluded by default
}
