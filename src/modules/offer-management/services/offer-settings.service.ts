import { Injectable, NotFoundException } from '@nestjs/common';
import { OfferSettingsRepository } from '../repositories/offer-settings.repository';
import { OfferSettings } from '../entities/offer-settings.entity';
import { UpdateOfferSettingsDto } from '../dto/offer-settings.dto';
import type { LoggedInUser } from '../../auth/interfaces/logged-in-user.interface';

@Injectable()
export class OfferSettingsService {
  constructor(private readonly settingsRepo: OfferSettingsRepository) {}

  async getOrCreate(user: LoggedInUser): Promise<OfferSettings> {
    return this.settingsRepo.findOrCreateByOrg(user.organizationId, user.enterpriseId);
  }

  async update(user: LoggedInUser, dto: UpdateOfferSettingsDto): Promise<OfferSettings> {
    const settings = await this.getOrCreate(user);
    const updated = await this.settingsRepo.update(settings.id, {
      ...dto,
      modified_by: user.userId,
    });
    if (!updated) throw new NotFoundException('Offer settings not found after update');
    return updated;
  }
}
