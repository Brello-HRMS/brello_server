import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { OfferDocumentRepository } from '../repositories/offer-document.repository';
import { OfferRepository } from '../repositories/offer.repository';
import { LoggedInUser } from '../../auth/interfaces/logged-in-user.interface';
import { OfferDocument } from '../entities/offer-document.entity';

@Injectable()
export class OfferDocumentService {
  constructor(
    private readonly docRepo: OfferDocumentRepository,
    private readonly offerRepo: OfferRepository,
  ) {}

  async getDocumentsForOffer(offerId: string): Promise<OfferDocument[]> {
    return this.docRepo.findByOfferId(offerId);
  }

  async addDocument(
    offerId: string,
    dto: { document_type: string; file_url: string; original_filename?: string; uploaded_by_candidate?: boolean },
  ): Promise<OfferDocument> {
    const offer = await this.offerRepo.findById(offerId);
    if (!offer) {
      throw new NotFoundException(`Offer ${offerId} not found`);
    }

    return this.docRepo.create({
      offer_id: offerId,
      document_type: dto.document_type,
      file_url: dto.file_url,
      original_filename: dto.original_filename ?? null,
      verification_status: 'pending',
      uploaded_by_candidate: dto.uploaded_by_candidate ?? true,
      enterprise_id: offer.enterprise_id,
      organization_id: offer.organization_id,
    });
  }

  async updateVerificationStatus(
    user: LoggedInUser,
    documentId: string,
    dto: { status: 'verified' | 'rejected'; reason?: string },
  ): Promise<OfferDocument> {
    const doc = await this.docRepo.findById(documentId);
    if (!doc) {
      throw new NotFoundException(`Offer document ${documentId} not found`);
    }

    if (doc.organization_id !== user.organizationId) {
      throw new BadRequestException('Document does not belong to your organization');
    }

    const updated = await this.docRepo.update(documentId, {
      verification_status: dto.status,
      verified_by: user.userId,
      verified_at: new Date(),
      rejection_reason: dto.status === 'rejected' ? (dto.reason ?? null) : null,
      modified_by: user.userId,
    });

    return updated!;
  }

  async deleteDocument(user: LoggedInUser, documentId: string): Promise<void> {
    const doc = await this.docRepo.findById(documentId);
    if (!doc) {
      throw new NotFoundException(`Offer document ${documentId} not found`);
    }

    if (doc.organization_id !== user.organizationId) {
      throw new BadRequestException('Document does not belong to your organization');
    }

    await this.docRepo.remove(documentId);
  }
}
