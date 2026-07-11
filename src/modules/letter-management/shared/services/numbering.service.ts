import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { LetterSettingsRepository } from '../../settings/repositories/letter-settings.repository';
import { LetterSettings } from '../../settings/entities/letter-settings.entity';
import { Status } from '../../../../common/enums';
import type { LoggedInUser } from '../../../auth/interfaces/logged-in-user.interface';

/**
 * Reserves the next sequential letter number for an organization, inside an
 * in-flight generation transaction. Uses a pessimistic row lock on the org's
 * LetterSettings row so two concurrent generations can never receive the
 * same number — see LetterSettingsRepository.lockByOrganizationId.
 */
@Injectable()
export class NumberingService {
  constructor(private readonly settingsRepository: LetterSettingsRepository) {}

  async reserveNumber(user: LoggedInUser, manager: EntityManager): Promise<string> {
    let settings = await this.settingsRepository.lockByOrganizationId(
      user.organizationId,
      manager,
    );

    const thisYear = new Date().getFullYear();

    if (!settings) {
      settings = await this.settingsRepository.createWithManager(
        {
          organization_id: user.organizationId,
          enterprise_id: user.enterpriseId,
          modified_by: user.userId,
          letter_prefix: 'BRLO',
          current_year: thisYear,
          last_sequence: 1,
          date_format: 'DD MMM YYYY',
          status: Status.ACTIVE,
        },
        manager,
      );
      return this.format(settings.letter_prefix, settings.current_year, settings.last_sequence);
    }

    const nextYear = settings.current_year !== thisYear;
    const nextSequence = nextYear ? 1 : settings.last_sequence + 1;

    await manager.update(LetterSettings, settings.id, {
      current_year: thisYear,
      last_sequence: nextSequence,
      modified_by: user.userId,
    });

    return this.format(settings.letter_prefix, thisYear, nextSequence);
  }

  private format(prefix: string, year: number, sequence: number): string {
    return `${prefix}-${year}-${String(sequence).padStart(6, '0')}`;
  }
}
