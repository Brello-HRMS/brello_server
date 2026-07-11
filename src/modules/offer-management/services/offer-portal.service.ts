import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { OfferVersionRepository } from '../repositories/offer-version.repository';
import { OfferRepository } from '../repositories/offer.repository';
import { OfferTimelineRepository } from '../repositories/offer-timeline.repository';
import { OfferCandidateRepository } from '../repositories/offer-candidate.repository';
import { OfferNotificationService } from './offer-notification.service';
import { OfferStatus } from '../enums/offer-status.enum';
import { OfferTimelineEvent } from '../enums/offer-timeline-event.enum';
import {
  CandidateAcceptDto,
  CandidateRejectDto,
  CandidateRequestChangesDto,
  CandidateSendMessageDto,
  CandidateUploadDocumentDto,
} from '../dto/offer-portal.dto';
import type { OfferVersion } from '../entities/offer-version.entity';
import type { Offer } from '../entities/offer.entity';

/** All operations are authenticated via the access_token in each DTO — no JWT. */
@Injectable()
export class OfferPortalService {
  constructor(
    private readonly versionRepo: OfferVersionRepository,
    private readonly offerRepo: OfferRepository,
    private readonly timelineRepo: OfferTimelineRepository,
    private readonly candidateRepo: OfferCandidateRepository,
    private readonly notificationService: OfferNotificationService,
  ) {}

  async getPortalData(token: string) {
    const { version, offer } = await this.resolveToken(token);
    const candidate = await this.candidateRepo.findOneByOrg(
      offer.candidate_id,
      offer.organization_id,
    );
    if (!candidate) throw new NotFoundException('Candidate data not found');

    await this.markViewed(version, offer);

    return { offer, version, candidate };
  }

  async accept(dto: CandidateAcceptDto): Promise<void> {
    const { version, offer } = await this.resolveToken(dto.access_token);
    this.assertOpenForResponse(offer);

    await this.offerRepo.update(offer.id, {
      offer_status: OfferStatus.ACCEPTED,
      accepted_at: new Date(),
    });

    await this.versionRepo.update(version.id, {
      candidate_response: 'accepted',
      responded_at: new Date(),
    });

    await this.timelineRepo.record({
      offer_id: offer.id,
      offer_version_id: version.id,
      event: OfferTimelineEvent.OFFER_ACCEPTED,
      label: 'Candidate accepted the offer',
      organization_id: offer.organization_id,
      enterprise_id: offer.enterprise_id,
    });

    await this.notifyHr(offer, 'accepted');
  }

  async reject(dto: CandidateRejectDto): Promise<void> {
    const { version, offer } = await this.resolveToken(dto.access_token);
    this.assertOpenForResponse(offer);

    await this.offerRepo.update(offer.id, {
      offer_status: OfferStatus.REJECTED,
      rejected_at: new Date(),
      rejection_reason: dto.reason,
      candidate_comment: dto.comment ?? null,
    });

    await this.versionRepo.update(version.id, {
      candidate_response: 'rejected',
      responded_at: new Date(),
    });

    await this.timelineRepo.record({
      offer_id: offer.id,
      offer_version_id: version.id,
      event: OfferTimelineEvent.OFFER_REJECTED,
      label: 'Candidate rejected the offer',
      metadata: { reason: dto.reason },
      organization_id: offer.organization_id,
      enterprise_id: offer.enterprise_id,
    });

    await this.notifyHr(offer, 'rejected');
  }

  async requestChanges(dto: CandidateRequestChangesDto): Promise<void> {
    const { version, offer } = await this.resolveToken(dto.access_token);
    this.assertOpenForResponse(offer);

    await this.offerRepo.update(offer.id, { offer_status: OfferStatus.NEGOTIATING });

    await this.versionRepo.update(version.id, {
      candidate_response: 'changes_requested',
      responded_at: new Date(),
      negotiation_request: {
        expected_salary: dto.expected_salary,
        preferred_joining_date: dto.preferred_joining_date,
        comments: dto.comments,
        attachments: dto.attachments ?? [],
      },
    });

    await this.timelineRepo.record({
      offer_id: offer.id,
      offer_version_id: version.id,
      event: OfferTimelineEvent.CHANGE_REQUESTED,
      label: 'Candidate requested changes',
      metadata: { expected_salary: dto.expected_salary, preferred_joining_date: dto.preferred_joining_date },
      organization_id: offer.organization_id,
      enterprise_id: offer.enterprise_id,
    });

    await this.notifyHr(offer, 'change_requested');
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private async resolveToken(token: string): Promise<{ version: OfferVersion; offer: Offer }> {
    const version = await this.versionRepo.findByToken(token);
    if (!version || !version.is_active) {
      throw new ForbiddenException('Invalid or expired offer link');
    }
    if (version.token_expires_at && version.token_expires_at < new Date()) {
      throw new ForbiddenException('This offer link has expired');
    }

    const offer = await this.offerRepo.findOneByOrg(version.offer_id, version.organization_id);
    if (!offer) throw new NotFoundException('Offer not found');

    return { version, offer };
  }

  private assertOpenForResponse(offer: Offer): void {
    const closedStatuses: OfferStatus[] = [
      OfferStatus.ACCEPTED,
      OfferStatus.REJECTED,
      OfferStatus.WITHDRAWN,
      OfferStatus.EXPIRED,
      OfferStatus.SYNCED,
    ];
    if (closedStatuses.includes(offer.offer_status)) {
      throw new BadRequestException(`Offer is already ${offer.offer_status.toLowerCase()}`);
    }
  }

  private async markViewed(version: OfferVersion, offer: Offer): Promise<void> {
    if (version.viewed_at) return; // already recorded

    await this.versionRepo.update(version.id, { viewed_at: new Date() });

    if (offer.offer_status === OfferStatus.SENT) {
      await this.offerRepo.update(offer.id, {
        offer_status: OfferStatus.VIEWED,
        viewed_at: new Date(),
      });
    }

    await this.timelineRepo.record({
      offer_id: offer.id,
      offer_version_id: version.id,
      event: OfferTimelineEvent.OFFER_VIEWED,
      label: 'Candidate viewed the offer',
      organization_id: offer.organization_id,
      enterprise_id: offer.enterprise_id,
    });

    await this.notifyHr(offer, 'viewed');
  }

  private async notifyHr(offer: Offer, event: 'viewed' | 'accepted' | 'rejected' | 'change_requested'): Promise<void> {
    if (!offer.modified_by) return;
    const candidate = await this.candidateRepo.findOneByOrg(offer.candidate_id, offer.organization_id);
    if (!candidate) return;

    const payload = { hrUserId: offer.modified_by, offer, candidate };
    if (event === 'viewed') await this.notificationService.notifyHrOfferViewed(payload);
    if (event === 'accepted') await this.notificationService.notifyHrOfferAccepted(payload);
    if (event === 'rejected') await this.notificationService.notifyHrOfferRejected(payload);
    if (event === 'change_requested') await this.notificationService.notifyHrChangeRequested(payload);
  }
}
