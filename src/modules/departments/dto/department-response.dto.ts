import { Status } from '../../../common/enums';

/**
 * Department Response DTO
 *
 * Typed response shape returned to API consumers.
 * Mirrors the Department entity fields, omitting internal fields
 * like is_deleted or raw DB metadata.
 */
export class DepartmentResponseDto {
    id: string;
    organization_id: string;
    enterprise_id: string;
    code: string;
    name: string;
    status: Status;
    description: string | null;
    icon: string | null;
    modified_by: string | null;
    created_at: Date;
    updated_at: Date;
}
