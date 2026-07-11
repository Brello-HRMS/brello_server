import { Injectable, Logger } from '@nestjs/common';
import { LetterSettingsRepository } from '../repositories/letter-settings.repository';
import { LetterSettings } from '../entities/letter-settings.entity';
import { UpdateLetterSettingsDto } from '../dto/letter-settings.dto';
import { LoggedInUser } from '../../../auth/interfaces/logged-in-user.interface';
import { AuditContextService } from '../../../audit/services/audit-context.service';

@Injectable()
export class LetterSettingsService {
  private readonly logger = new Logger(LetterSettingsService.name);

  constructor(
    private readonly settingsRepository: LetterSettingsRepository,
    private readonly auditContext: AuditContextService,
  ) {}

  /**
   * Lazily creates the org's settings row on first access, per the
   * "no eager per-org bootstrap hook" decision — this avoids requiring
   * an org-creation lifecycle event just to seed a settings row.
   */
  async get(user: LoggedInUser): Promise<LetterSettings> {
    this.logger.log(`User ${user.userId} is fetching letter settings`);
    return this.settingsRepository.findOrCreateForOrg(user.organizationId, {
      enterpriseId: user.enterpriseId,
      userId: user.userId,
    });
  }

  async update(user: LoggedInUser, dto: UpdateLetterSettingsDto): Promise<LetterSettings> {
    const existing = await this.get(user);
    this.auditContext.setPreValue(existing as unknown as Record<string, unknown>);

    const updated = await this.settingsRepository.update(user.organizationId, {
      ...dto,
      modified_by: user.userId,
    });

    // update() re-fetches by organization_id right after the UPDATE we just
    // issued for this same org, so a null result here would indicate the
    // unique settings row vanished between get() and update() — not expected
    // in normal operation, but fall back to the pre-update value rather than
    // throwing, since settings always exist once lazily created.
    return updated ?? existing;
  }
}
