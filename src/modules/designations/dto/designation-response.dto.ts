import { Exclude, Expose } from 'class-transformer';
import { Status } from '../../../common/enums/status.enum';

/**
 * Designation Response DTO
 *
 * Controls exactly what fields are sent back to API consumers.
 * Uses class-transformer @Exclude / @Expose to prevent accidental
 * leakage of internal or future fields.
 */
@Exclude()
export class DesignationResponseDto {
    @Expose()
    id: string;

    @Expose()
    org_id: string;

    @Expose()
    department_id: string | null;

    @Expose()
    code: string;

    @Expose()
    title: string;

    @Expose()
    level: string | null;

    @Expose()
    status: Status;

    @Expose()
    description: string | null;

    @Expose()
    created_at: Date;

    @Expose()
    updated_at: Date;
}
