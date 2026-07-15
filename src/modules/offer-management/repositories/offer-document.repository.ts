import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OfferDocument } from '../entities/offer-document.entity';

@Injectable()
export class OfferDocumentRepository {
  constructor(
    @InjectRepository(OfferDocument)
    private readonly repo: Repository<OfferDocument>,
  ) {}

  async create(data: Partial<OfferDocument>): Promise<OfferDocument> {
    const doc = this.repo.create(data);
    return this.repo.save(doc);
  }

  async findByOfferId(offerId: string): Promise<OfferDocument[]> {
    return this.repo.find({
      where: { offer_id: offerId },
      order: { created_at: 'ASC' },
    });
  }

  async findById(id: string): Promise<OfferDocument | null> {
    return this.repo.findOne({ where: { id } });
  }

  async update(id: string, data: Partial<OfferDocument>): Promise<OfferDocument | null> {
    await this.repo.update(id, data);
    return this.findById(id);
  }

  async remove(id: string): Promise<void> {
    await this.repo.delete(id);
  }
}
