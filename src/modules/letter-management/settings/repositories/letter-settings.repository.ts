import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { LetterSettings } from '../entities/letter-settings.entity';
import { Status } from '../../../../common/enums';

@Injectable()
export class LetterSettingsRepository {
  constructor(
    @InjectRepository(LetterSettings)
    private readonly repo: Repository<LetterSettings>,
    private readonly dataSource: DataSource,
  ) {}

  async findByOrg(organizationId: string): Promise<LetterSettings | null> {
    return this.repo.findOne({ where: { organization_id: organizationId } });
  }

  async findOrCreateForOrg(
    organizationId: string,
    actor: { enterpriseId: string; userId: string },
  ): Promise<LetterSettings> {
    const existing = await this.findByOrg(organizationId);
    if (existing) {
      return existing;
    }

    const created = this.repo.create({
      organization_id: organizationId,
      enterprise_id: actor.enterpriseId,
      modified_by: actor.userId,
      current_year: new Date().getFullYear(),
      last_sequence: 0,
      letter_prefix: 'BRLO',
      date_format: 'DD MMM YYYY',
      status: Status.ACTIVE,
    });

    return this.repo.save(created);
  }

  async update(
    organizationId: string,
    data: Partial<LetterSettings>,
  ): Promise<LetterSettings | null> {
    await this.repo.update({ organization_id: organizationId }, data);
    return this.findByOrg(organizationId);
  }

  /**
   * Row-locks the single settings row for an organization using an
   * externally-supplied EntityManager, so the caller (e.g. the future
   * NumberingService in shared/) can run this INSIDE its own in-flight
   * transaction alongside other locked reads/writes.
   *
   * Pattern copied from the codebase's established row-locking precedent:
   * src/modules/leave-balance/repositories/leave-balance.repository.ts's
   * lockOneByCompositeKey.
   */
  async lockByOrganizationId(
    organizationId: string,
    manager: EntityManager,
  ): Promise<LetterSettings | null> {
    return manager
      .createQueryBuilder(LetterSettings, 's')
      .setLock('pessimistic_write')
      .where('s.organization_id = :organizationId', { organizationId })
      .getOne();
  }

  /**
   * Creates the settings row using the caller's own EntityManager/transaction.
   * Used when lockByOrganizationId returns null (row doesn't exist yet) and
   * the caller needs to create it inside the same transaction before
   * locking/incrementing it.
   */
  async createWithManager(
    data: Partial<LetterSettings>,
    manager: EntityManager,
  ): Promise<LetterSettings> {
    return manager.save(manager.create(LetterSettings, data));
  }
}
