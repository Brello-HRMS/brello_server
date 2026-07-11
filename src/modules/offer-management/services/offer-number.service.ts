import { Injectable } from '@nestjs/common';
import { OfferSettingsRepository } from '../repositories/offer-settings.repository';

/** Generates sequential offer numbers: OFF-2026-000145. */
@Injectable()
export class OfferNumberService {
  constructor(private readonly settingsRepo: OfferSettingsRepository) {}

  async generate(organizationId: string, enterpriseId: string): Promise<string> {
    const settings = await this.settingsRepo.findOrCreateByOrg(organizationId, enterpriseId);
    const year = new Date().getFullYear();
    const seq = await this.settingsRepo.nextSequence(settings.id, year);
    const paddedSeq = String(seq).padStart(6, '0');
    return `${settings.offer_prefix}-${year}-${paddedSeq}`;
  }
}
