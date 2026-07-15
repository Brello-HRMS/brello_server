import { Injectable, NotFoundException } from '@nestjs/common';
import { OfferMessageRepository } from '../repositories/offer-message.repository';
import { OfferRepository } from '../repositories/offer.repository';
import { LoggedInUser } from '../../auth/interfaces/logged-in-user.interface';
import { OfferMessage } from '../entities/offer-message.entity';

@Injectable()
export class OfferMessageService {
  constructor(
    private readonly msgRepo: OfferMessageRepository,
    private readonly offerRepo: OfferRepository,
  ) {}

  async getMessages(offerId: string, asSenderType: 'hr' | 'candidate'): Promise<OfferMessage[]> {
    const offer = await this.offerRepo.findById(offerId);
    if (!offer) throw new NotFoundException('Offer not found');

    // Mark messages from the other party as read
    await this.msgRepo.markAsRead(offerId, asSenderType);

    return this.msgRepo.findByOfferId(offerId);
  }

  async sendHrMessage(
    user: LoggedInUser,
    offerId: string,
    message: string,
    attachments: string[] = [],
  ): Promise<OfferMessage> {
    const offer = await this.offerRepo.findById(offerId);
    if (!offer) throw new NotFoundException('Offer not found');

    return this.msgRepo.create({
      offer_id: offerId,
      sender_type: 'hr',
      sender_id: user.userId,
      sender_name: 'HR Team', // Or fetch from user profile
      message,
      attachments,
      enterprise_id: user.enterpriseId,
      organization_id: user.organizationId,
    });
  }

  async sendCandidateMessage(
    offerId: string,
    candidateName: string,
    message: string,
    attachments: string[] = [],
  ): Promise<OfferMessage> {
    const offer = await this.offerRepo.findById(offerId);
    if (!offer) throw new NotFoundException('Offer not found');

    return this.msgRepo.create({
      offer_id: offerId,
      sender_type: 'candidate',
      sender_id: null,
      sender_name: candidateName,
      message,
      attachments,
      enterprise_id: offer.enterprise_id,
      organization_id: offer.organization_id,
    });
  }
}
