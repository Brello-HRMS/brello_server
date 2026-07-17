import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { EmailProvider } from '../enums/email-provider.enum';

/**
 * EmailIntegration Entity
 *
 * A connected outbound email account (currently Gmail via OAuth, send-only) for
 * an organization. Extends BaseEntity, so `organization_id` / `enterprise_id`
 * tenant scoping and soft-delete (`status`) come for free.
 *
 * Lifecycle:
 *   - `status = ACTIVE`  → connection exists / usable
 *   - `status = DELETED` → disconnected (soft delete; token revoked at Google)
 *
 * `is_active` is separate from `status`: it marks the ONE account currently used
 * as the organization's outbound sender. At most one row per organization has
 * `is_active = true` (enforced in the service layer).
 */
@Entity('email_integrations')
@Index(['organization_id', 'status'])
export class EmailIntegration extends BaseEntity {
  /** Upstream provider (gmail). */
  @Column({ type: 'enum', enum: EmailProvider, default: EmailProvider.GMAIL })
  provider: EmailProvider;

  /** The connected Google account email — this becomes the outbound "from". */
  @Column({ type: 'varchar', length: 320 })
  email: string;

  /** Human-friendly name from the Google profile, if available. */
  @Column({ type: 'varchar', length: 255, nullable: true })
  display_name: string;

  /** Stable Google account identifier (the OpenID `sub` claim). */
  @Column({ type: 'varchar', length: 255, nullable: true })
  google_sub: string;

  /** OAuth refresh token, AES-256-GCM encrypted at rest. Never returned by API. */
  @Column({ type: 'text' })
  refresh_token_encrypted: string;

  /** Space-delimited OAuth scopes granted by the user. */
  @Column({ type: 'varchar', length: 500, nullable: true })
  scope: string;

  /** Whether this is the organization's active outbound sender (one per org). */
  @Column({ type: 'boolean', default: false })
  is_active: boolean;

  /** Access-token expiry from the last refresh, for observability. */
  @Column({ type: 'timestamp', nullable: true })
  token_expires_at: Date;

  /** Last time an email was sent through this integration. */
  @Column({ type: 'timestamp', nullable: true })
  last_used_at: Date;

  /** User who connected this account. */
  @Column({ type: 'uuid', nullable: true })
  connected_by: string;
}
