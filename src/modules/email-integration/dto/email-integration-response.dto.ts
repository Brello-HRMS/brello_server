import { EmailProvider } from '../enums/email-provider.enum';
import { Status } from '../../../common/enums';
import { EmailIntegration } from '../entities/email-integration.entity';

/**
 * Safe, API-facing view of an EmailIntegration.
 * NEVER exposes the encrypted refresh token or any secret material.
 */
export class EmailIntegrationResponseDto {
  id: string;
  provider: EmailProvider;
  email: string;
  display_name: string | null;
  is_active: boolean;
  status: Status;
  last_used_at: Date | null;
  connected_by: string | null;
  created_at: Date;

  static fromEntity(entity: EmailIntegration): EmailIntegrationResponseDto {
    return {
      id: entity.id,
      provider: entity.provider,
      email: entity.email,
      display_name: entity.display_name ?? null,
      is_active: entity.is_active,
      status: entity.status,
      last_used_at: entity.last_used_at ?? null,
      connected_by: entity.connected_by ?? null,
      created_at: entity.created_at,
    };
  }
}
