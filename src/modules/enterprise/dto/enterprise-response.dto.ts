import { Exclude, Expose } from 'class-transformer';

/**
 * Enterprise Response DTO
 * 
 * Data Transfer Object for enterprise responses.
 * Controls what data is exposed to API consumers.
 * 
 * Design Pattern: DTO Pattern
 * - Separates internal representation from external API contract
 * - Prevents accidental exposure of sensitive data
 */
@Exclude()
export class EnterpriseResponseDto {
    @Expose()
    id: string;

    @Expose()
    name: string;

    @Expose()
    domain: string;

    @Expose()
    created_at: Date;

    @Expose()
    updated_at: Date;
}
