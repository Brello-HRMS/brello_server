import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OfferSettings } from '../entities/offer-settings.entity';

const DEFAULT_SETTINGS: Partial<OfferSettings> = {
  offer_prefix: 'OFF',
  offer_expiry_days: 7,
  reminder_days_before_expiry: [3, 1],
  allow_download: true,
  enable_request_changes: true,
  enable_digital_signature: true,
  auto_welcome_email: true,
  approval_chain: [],
  last_sequence: 0,
};

@Injectable()
export class OfferSettingsRepository {
  constructor(
    @InjectRepository(OfferSettings)
    private readonly repo: Repository<OfferSettings>,
  ) {}

  async findOrCreateByOrg(organizationId: string, enterpriseId: string): Promise<OfferSettings> {
    const existing = await this.repo.findOne({ where: { organization_id: organizationId } });
    if (existing) return existing;

    const settings = this.repo.create({
      ...DEFAULT_SETTINGS,
      organization_id: organizationId,
      enterprise_id: enterpriseId,
      sequence_year: new Date().getFullYear(),
    });
    return this.repo.save(settings);
  }

  /** All organizations' settings — used by the scheduler to honor per-org reminder schedules. */
  async findAll(): Promise<OfferSettings[]> {
    return this.repo.find();
  }

  async update(id: string, data: Partial<OfferSettings>): Promise<OfferSettings | null> {
    await this.repo.update(id, data);
    return this.repo.findOne({ where: { id } });
  }

  /** Atomically increment and return the next sequence number for offer numbering. */
  async nextSequence(settingsId: string, year: number): Promise<number> {
    await this.repo
      .createQueryBuilder()
      .update(OfferSettings)
      .set({
        last_sequence: () =>
          `CASE WHEN sequence_year = ${year} THEN last_sequence + 1 ELSE 1 END`,
        sequence_year: year,
      })
      .where('id = :id', { id: settingsId })
      .execute();

    const updated = await this.repo.findOne({ where: { id: settingsId } });
    return updated?.last_sequence ?? 1;
  }
}
