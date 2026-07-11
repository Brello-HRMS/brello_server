import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OfferVersion } from '../entities/offer-version.entity';

@Injectable()
export class OfferVersionRepository {
  constructor(
    @InjectRepository(OfferVersion)
    private readonly repo: Repository<OfferVersion>,
  ) {}

  async create(data: Partial<OfferVersion>): Promise<OfferVersion> {
    const version = this.repo.create(data);
    return this.repo.save(version);
  }

  async findAllByOffer(offerId: string): Promise<OfferVersion[]> {
    return this.repo.find({
      where: { offer_id: offerId },
      order: { version_number: 'DESC' },
    });
  }

  async findActiveByOffer(offerId: string): Promise<OfferVersion | null> {
    return this.repo.findOne({
      where: { offer_id: offerId, is_active: true },
    });
  }

  async findByToken(token: string): Promise<OfferVersion | null> {
    return this.repo.findOne({ where: { access_token: token } });
  }

  async deactivateAllByOffer(offerId: string): Promise<void> {
    await this.repo.update({ offer_id: offerId }, { is_active: false });
  }

  async update(id: string, data: Partial<OfferVersion>): Promise<OfferVersion | null> {
    await this.repo.update(id, data);
    return this.repo.findOne({ where: { id } });
  }
}
