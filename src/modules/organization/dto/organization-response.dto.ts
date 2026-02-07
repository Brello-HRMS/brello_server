import { Exclude, Expose, Type } from 'class-transformer';
import { EnterpriseResponseDto } from '../../enterprise/dto/enterprise-response.dto';

/**
 * Organization Response DTO
 * 
 * Data Transfer Object for organization responses.
 * Controls what data is exposed to API consumers.
 * 
 * Design Pattern: DTO Pattern
 * - Separates internal representation from external API contract
 * - Prevents accidental exposure of sensitive data
 */
@Exclude()
export class OrganizationResponseDto {
    @Expose()
    id: string;

    @Expose()
    name: string;

    @Expose()
    enterprise_id: string;

    @Expose()
    @Type(() => EnterpriseResponseDto)
    enterprise: EnterpriseResponseDto;

    @Expose()
    created_at: Date;

    @Expose()
    updated_at: Date;
}
