import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OfferMessage } from '../entities/offer-message.entity';

@Injectable()
export class OfferMessageRepository {
  constructor(
    @InjectRepository(OfferMessage)
    private readonly repo: Repository<OfferMessage>,
  ) {}

  async create(data: Partial<OfferMessage>): Promise<OfferMessage> {
    const msg = this.repo.create(data);
    return this.repo.save(msg);
  }

  async findByOfferId(offerId: string): Promise<OfferMessage[]> {
    return this.repo.find({
      where: { offer_id: offerId },
      order: { created_at: 'ASC' },
    });
  }

  async markAsRead(offerId: string, senderType: 'hr' | 'candidate'): Promise<void> {
    // If HR is reading, mark candidate messages as read, and vice versa
    const targetSender = senderType === 'hr' ? 'candidate' : 'hr';
    await this.repo.update(
      { offer_id: offerId, sender_type: targetSender, is_read: false },
      { is_read: true, read_at: new Date() },
    );
  }
}
