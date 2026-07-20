import { Injectable, Logger, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OfferVersionRepository } from '../repositories/offer-version.repository';
import { OfferRepository } from '../repositories/offer.repository';
import { OfferTimelineRepository } from '../repositories/offer-timeline.repository';
import { OfferCandidateRepository } from '../repositories/offer-candidate.repository';
import { OfferSettingsRepository } from '../repositories/offer-settings.repository';
import { OfferNotificationService } from './offer-notification.service';
import { OfferPdfService } from './offer-pdf.service';
import { CompanyPolicyService } from '../../company-policy/services/company-policy.service';
import { DocumentService } from '../../document/services/document.service';
import { FolderType } from '../../document/enums/document.enum';
import { OfferStatus } from '../enums/offer-status.enum';
import { OfferTimelineEvent } from '../enums/offer-timeline-event.enum';
import {
  CandidateAcceptDto,
  CandidateRejectDto,
  CandidateRequestChangesDto,
} from '../dto/offer-portal.dto';
import type { OfferVersion } from '../entities/offer-version.entity';
import type { Offer } from '../entities/offer.entity';
import type { LoggedInUser } from '../../auth/interfaces/logged-in-user.interface';

/** All operations are authenticated via the access_token in each DTO — no JWT. */
@Injectable()
export class OfferPortalService {
  private readonly logger = new Logger(OfferPortalService.name);

  constructor(
    private readonly versionRepo: OfferVersionRepository,
    private readonly offerRepo: OfferRepository,
    private readonly timelineRepo: OfferTimelineRepository,
    private readonly candidateRepo: OfferCandidateRepository,
    private readonly settingsRepo: OfferSettingsRepository,
    private readonly notificationService: OfferNotificationService,
    private readonly offerPdfService: OfferPdfService,
    private readonly companyPolicyService: CompanyPolicyService,
    private readonly configService: ConfigService,
    private readonly documentService: DocumentService,
  ) {}

  async getPortalData(token: string) {
    const { version, offer } = await this.resolveToken(token);
    const candidate = await this.candidateRepo.findOneByOrg(
      offer.candidate_id,
      offer.organization_id,
    );
    if (!candidate) throw new NotFoundException('Candidate data not found');

    await this.markViewed(version, offer);

    const policies = await this.companyPolicyService.findByIdsForOrg(
      offer.policy_ids,
      offer.organization_id,
    );

    const settings = await this.settingsRepo.findOrCreateByOrg(
      offer.organization_id,
      offer.enterprise_id,
    );

    return { offer, version, candidate, policies, settings };
  }

  async accept(dto: CandidateAcceptDto): Promise<{ accepted_pdf_url: string | null }> {
    const { version, offer } = await this.resolveToken(dto.access_token);
    this.assertOpenForResponse(offer);

    const acceptedAt = new Date();

    await this.offerRepo.update(offer.id, {
      offer_status: OfferStatus.ACCEPTED,
      accepted_at: acceptedAt,
      expires_at: null,
    });

    await this.versionRepo.update(version.id, {
      candidate_response: 'accepted',
      responded_at: acceptedAt,
    });

    await this.timelineRepo.record({
      offer_id: offer.id,
      offer_version_id: version.id,
      event: OfferTimelineEvent.OFFER_ACCEPTED,
      label: 'Candidate accepted the offer',
      organization_id: offer.organization_id,
      enterprise_id: offer.enterprise_id,
    });

    const candidate = await this.candidateRepo.findOneByOrg(offer.candidate_id, offer.organization_id);
    const acceptedPdfUrl = candidate
      ? await this.generateAcceptanceProof(offer, version, candidate, acceptedAt)
      : null;

    await this.notifyHr(offer, 'accepted');

    if (candidate) {
      const baseUrl = this.configService.get<string>('FRONTEND_URL', 'https://brello.co.in');
      const portalLink = `${baseUrl}/offer-portal/${dto.access_token}`;

      await this.notificationService.sendAcceptanceConfirmationEmail({
        candidate,
        offer,
        portalLink,
        acceptedPdfUrl: acceptedPdfUrl ?? undefined,
      });

      if (!acceptedPdfUrl && offer.modified_by) {
        await this.notificationService.notifyHrAcceptanceProofFailed({
          hrUserId: offer.modified_by,
          offer,
          candidate,
        });
      }
    }

    return { accepted_pdf_url: acceptedPdfUrl };
  }

  /**
   * Regenerates the offer PDF with an acceptance watermark/timestamp and
   * stores it on the version — this is the candidate's proof of acceptance,
   * kept separate from the original sent PDF (which stays an immutable
   * record of what was offered). Attributed to the HR user who last touched
   * the offer since acceptance itself has no authenticated actor.
   */
  private async generateAcceptanceProof(
    offer: Offer,
    version: OfferVersion,
    candidate: { first_name: string; last_name: string },
    acceptedAt: Date,
  ): Promise<string | null> {
    if (!offer.modified_by) return null;

    try {
      const settings = await this.settingsRepo.findOrCreateByOrg(offer.organization_id, offer.enterprise_id);

      const systemUser: LoggedInUser = {
        userId: offer.modified_by,
        enterpriseId: offer.enterprise_id,
        organizationId: offer.organization_id,
        appId: '',
        isPlatformAdmin: false,
      };

      const acceptedPdfUrl = await this.offerPdfService.generateAcceptedPdf(
        systemUser,
        offer,
        settings,
        version.version_number,
        `${candidate.first_name} ${candidate.last_name}`,
        acceptedAt,
      );
      if (!acceptedPdfUrl) return null;

      await this.versionRepo.update(version.id, {
        accepted_pdf_url: acceptedPdfUrl,
        accepted_pdf_generated_at: acceptedAt,
      });

      return acceptedPdfUrl;
    } catch (err) {
      this.logger.warn(
        `Failed to generate acceptance proof for offer ${offer.id}: ${(err as Error).message}`,
      );
      return null;
    }
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

    const candidate = await this.candidateRepo.findOneByOrg(offer.candidate_id, offer.organization_id);
    if (candidate) {
      await this.notificationService.sendRejectionConfirmationEmail({ candidate, offer, portalLink: '' });
    }
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

    const candidate = await this.candidateRepo.findOneByOrg(offer.candidate_id, offer.organization_id);
    if (candidate) {
      await this.notificationService.sendChangeRequestConfirmationEmail({ candidate, offer, portalLink: '' });
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private async resolveToken(token: string): Promise<{ version: OfferVersion; offer: Offer }> {
    const version = await this.versionRepo.findByToken(token);
    if (!version || !version.is_active) {
      throw new ForbiddenException('Invalid or expired offer link');
    }

    const offer = await this.offerRepo.findOneByOrg(version.offer_id, version.organization_id);
    if (!offer) throw new NotFoundException('Offer not found');

    // If the offer is already accepted, we keep the link open indefinitely so they can access their documents.
    if (offer.offer_status !== OfferStatus.ACCEPTED && version.token_expires_at && version.token_expires_at < new Date()) {
      throw new ForbiddenException('This offer link has expired');
    }

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

  async uploadOnboardingDocument(token: string, name: string, file: any) {
    const { offer } = await this.resolveToken(token);
    if (offer.offer_status !== OfferStatus.ACCEPTED) {
      throw new BadRequestException('Documents can only be uploaded after the offer is accepted.');
    }

    const candidate = await this.candidateRepo.findById(offer.candidate_id);
    if (!candidate) throw new NotFoundException('Candidate not found');

    const systemUser: LoggedInUser = {
      userId: offer.modified_by ?? 'system',
      organizationId: offer.organization_id,
      enterpriseId: offer.enterprise_id,
      appId: 'offer-portal',
      isPlatformAdmin: false,
    };

    const doc = await this.documentService.uploadDocument(systemUser, file, FolderType.OFFER_DOCUMENT);
    const viewUrl = this.documentService.buildViewUrl(doc);

    const docs = candidate.onboarding_documents || [];
    docs.push({
      name,
      url: viewUrl,
      uploaded_at: new Date().toISOString(),
    });

    await this.candidateRepo.update(candidate.id, { onboarding_documents: docs });

    return { success: true, documents: docs };
  }
}
