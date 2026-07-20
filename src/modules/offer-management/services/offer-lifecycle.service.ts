import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { randomUUID } from 'crypto';
import { OfferRepository } from '../repositories/offer.repository';
import { OfferVersionRepository } from '../repositories/offer-version.repository';
import { OfferTimelineRepository } from '../repositories/offer-timeline.repository';
import { OfferCandidateRepository } from '../repositories/offer-candidate.repository';
import { OfferSettingsRepository } from '../repositories/offer-settings.repository';
import { OfferNumberService } from './offer-number.service';
import { OfferNotificationService } from './offer-notification.service';
import { OfferPdfService } from './offer-pdf.service';
import { OfferStatus } from '../enums/offer-status.enum';
import { OfferTimelineEvent } from '../enums/offer-timeline-event.enum';
import { Offer } from '../entities/offer.entity';
import { OfferVersion } from '../entities/offer-version.entity';
import { OfferTimeline } from '../entities/offer-timeline.entity';
import { CreateOfferDto, UpdateOfferDto, SendOfferDto, WithdrawOfferDto, ExtendExpiryDto, FilterOffersDto } from '../dto/offer.dto';
import type { PaginatedResponse } from '../../../common/dto/pagination.dto';
import type { LoggedInUser } from '../../auth/interfaces/logged-in-user.interface';
import { buildPortalLink } from '../utils/offer-portal.util';

/** Terminal states — no further transitions allowed. */
const TERMINAL_STATUSES = new Set([OfferStatus.ACCEPTED, OfferStatus.SYNCED]);

/**
 * Statuses where editing offer details/compensation (and, by the same logic,
 * (re)sending) no longer makes sense. Shared by findEditable()/assertSendable()
 * so the two stay in lockstep — a status you can revise is a status you should
 * be able to resend, and vice versa. Notably this does NOT include SENT,
 * VIEWED, or NEGOTIATING: those are exactly the statuses where HR needs to
 * revise the offer (e.g. after a candidate requests changes) and send a new
 * version, per the offer lifecycle (Sent -> Viewed -> Changes Requested ->
 * New Version -> Sent).
 */
const NON_EDITABLE_STATUSES = new Set([
  ...TERMINAL_STATUSES,
  OfferStatus.WITHDRAWN,
  OfferStatus.REJECTED,
  OfferStatus.EXPIRED,
  OfferStatus.PENDING_APPROVAL,
]);

@Injectable()
export class OfferLifecycleService {
  constructor(
    private readonly offerRepo: OfferRepository,
    private readonly versionRepo: OfferVersionRepository,
    private readonly timelineRepo: OfferTimelineRepository,
    private readonly candidateRepo: OfferCandidateRepository,
    private readonly settingsRepo: OfferSettingsRepository,
    private readonly numberService: OfferNumberService,
    private readonly notificationService: OfferNotificationService,
    private readonly offerPdfService: OfferPdfService,
    private readonly dataSource: DataSource,
  ) {}

  async createDraft(user: LoggedInUser, dto: CreateOfferDto): Promise<Offer> {
    await this.assertNoDuplicateOffer(dto.candidate_id, user.organizationId);

    const offer = await this.offerRepo.create({
      candidate_id: dto.candidate_id,
      template_id: dto.template_id ?? null,
      ...this.flattenDetails(dto),
      offer_status: OfferStatus.DRAFT,
      current_version: 0,
      organization_id: user.organizationId,
      enterprise_id: user.enterpriseId,
      modified_by: user.userId,
    });

    await this.timelineRepo.record({
      offer_id: offer.id,
      event: OfferTimelineEvent.DRAFT_CREATED,
      label: 'Offer draft created',
      actor_id: user.userId,
      organization_id: user.organizationId,
      enterprise_id: user.enterpriseId,
    });

    return offer;
  }

  async updateDraft(user: LoggedInUser, id: string, dto: UpdateOfferDto): Promise<Offer> {
    const offer = await this.findEditable(user, id);

    await this.dataSource.transaction(async (manager) => {
      await manager.update(Offer, id, {
        template_id: dto.template_id ?? offer.template_id,
        ...this.flattenDetails(dto),
        modified_by: user.userId,
      });

      const timeline = manager.create(OfferTimeline, {
        offer_id: id,
        event: OfferTimelineEvent.DRAFT_UPDATED,
        label: offer.offer_status === OfferStatus.DRAFT ? 'Offer draft updated' : 'Offer revised — ready to resend',
        actor_id: user.userId,
        organization_id: user.organizationId,
        enterprise_id: user.enterpriseId,
      });
      await manager.save(timeline);
    });

    const updated = await this.offerRepo.findById(id);
    if (!updated) throw new NotFoundException(`Offer "${id}" not found after update`);
    return updated;
  }

  async sendOffer(user: LoggedInUser, id: string, dto: SendOfferDto): Promise<Offer> {
    const offer = await this.findByOrg(user, id);
    this.assertSendable(offer);

    const settings = await this.settingsRepo.findOrCreateByOrg(
      user.organizationId,
      user.enterpriseId,
    );

    // Generate offer number on first send
    const offerNumber =
      offer.offer_number ?? (await this.numberService.generate(user.organizationId, user.enterpriseId));

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + settings.offer_expiry_days);

    // Deactivate existing active version
    await this.versionRepo.deactivateAllByOffer(id);
    const newVersionNumber = (offer.current_version ?? 0) + 1;
    const token = randomUUID();

    const pdfUrl = await this.offerPdfService.generateAndUploadPdf(user, offer, settings, newVersionNumber);

    await this.dataSource.transaction(async (manager) => {
      await manager.update(OfferVersion, { offer_id: id }, { is_active: false });

      const version = manager.create(OfferVersion, {
        offer_id: id,
        version_number: newVersionNumber,
        is_active: true,
        access_token: token,
        token_expires_at: expiresAt,
        change_summary: dto.change_summary ?? null,
        pdf_url: pdfUrl,
        organization_id: user.organizationId,
        enterprise_id: user.enterpriseId,
      });
      await manager.save(version);

      await manager.update(Offer, id, {
        offer_number: offerNumber,
        offer_status: OfferStatus.SENT,
        current_version: newVersionNumber,
        sent_at: new Date(),
        expires_at: expiresAt,
        modified_by: user.userId,
      });

      const event =
        newVersionNumber === 1 ? OfferTimelineEvent.OFFER_SENT : OfferTimelineEvent.NEW_VERSION_CREATED;

      const timeline = manager.create(OfferTimeline, {
        offer_id: id,
        offer_version_id: version.id,
        event,
        label: newVersionNumber === 1 ? `Offer sent (v${newVersionNumber})` : `New version sent (v${newVersionNumber})`,
        actor_id: user.userId,
        organization_id: user.organizationId,
        enterprise_id: user.enterpriseId,
      });
      await manager.save(timeline);
    });

    const updatedOffer = await this.offerRepo.findById(id);
    if (!updatedOffer) throw new NotFoundException(`Offer "${id}" not found after send`);

    // Notify candidate by email
    const candidate = await this.candidateRepo.findOneByOrg(offer.candidate_id, user.organizationId);
    if (candidate) {
      const portalLink = buildPortalLink(token);
      await this.notificationService.sendOfferEmail({ candidate, offer: updatedOffer, portalLink });
    }

    return updatedOffer;
  }

  async withdrawOffer(user: LoggedInUser, id: string, dto: WithdrawOfferDto): Promise<Offer> {
    const offer = await this.findByOrg(user, id);
    this.assertWithdrawable(offer);

    await this.versionRepo.deactivateAllByOffer(id);

    const updated = await this.offerRepo.update(id, {
      offer_status: OfferStatus.WITHDRAWN,
      withdrawn_at: new Date(),
      modified_by: user.userId,
    });
    if (!updated) throw new NotFoundException(`Offer "${id}" not found after withdrawal`);

    await this.timelineRepo.record({
      offer_id: id,
      event: OfferTimelineEvent.OFFER_WITHDRAWN,
      label: 'Offer withdrawn',
      metadata: { reason: dto.reason },
      actor_id: user.userId,
      organization_id: user.organizationId,
      enterprise_id: user.enterpriseId,
    });

    const candidate = await this.candidateRepo.findOneByOrg(offer.candidate_id, user.organizationId);
    if (candidate) {
      await this.notificationService.sendWithdrawEmail({
        candidate,
        offer: updated,
        portalLink: '',
      });
    }

    return updated;
  }

  async extendExpiry(user: LoggedInUser, id: string, dto: ExtendExpiryDto): Promise<Offer> {
    const offer = await this.findByOrg(user, id);

    if (offer.offer_status === OfferStatus.EXPIRED) {
      // Allow extension of expired offers
    } else if (!this.isSent(offer)) {
      throw new ConflictException('Only sent offers can be extended');
    }

    const newExpiry = new Date(offer.expires_at ?? Date.now());
    newExpiry.setDate(newExpiry.getDate() + dto.extra_days);

    const updated = await this.offerRepo.update(id, {
      expires_at: newExpiry,
      offer_status: OfferStatus.SENT,
      modified_by: user.userId,
    });
    if (!updated) throw new NotFoundException(`Offer "${id}" not found after expiry extension`);

    await this.timelineRepo.record({
      offer_id: id,
      event: OfferTimelineEvent.EXPIRY_EXTENDED,
      label: `Expiry extended by ${dto.extra_days} days`,
      metadata: { new_expiry: newExpiry },
      actor_id: user.userId,
      organization_id: user.organizationId,
      enterprise_id: user.enterpriseId,
    });

    return updated;
  }

  async findAll(user: LoggedInUser, filters: FilterOffersDto): Promise<PaginatedResponse<Offer>> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 10;

    const { data, total } = await this.offerRepo.findAllByOrg(
      user.organizationId,
      { offer_status: filters.offer_status as OfferStatus, candidate_id: filters.candidate_id },
      { page, limit },
    );

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(user: LoggedInUser, id: string): Promise<Offer> {
    return this.findByOrg(user, id);
  }

  // ── Private Helpers ────────────────────────────────────────────────────────

  private async findByOrg(user: LoggedInUser, id: string): Promise<Offer> {
    const offer = await this.offerRepo.findOneByOrg(id, user.organizationId);
    if (!offer) throw new NotFoundException(`Offer "${id}" not found`);
    return offer;
  }

  private async findEditable(user: LoggedInUser, id: string): Promise<Offer> {
    const offer = await this.findByOrg(user, id);
    if (NON_EDITABLE_STATUSES.has(offer.offer_status)) {
      throw new ConflictException(
        `Offer cannot be edited from its current status: ${offer.offer_status}`,
      );
    }
    return offer;
  }

  private async assertNoDuplicateOffer(candidateId: string, organizationId: string): Promise<void> {
    const existing = await this.offerRepo.findByCandidateAndOrg(candidateId, organizationId);
    if (existing) {
      throw new ConflictException('An offer already exists for this candidate');
    }
  }

  private assertSendable(offer: Offer): void {
    if (NON_EDITABLE_STATUSES.has(offer.offer_status)) {
      throw new ConflictException(`Cannot send an offer with status: ${offer.offer_status}`);
    }
    if (offer.requires_approval && offer.offer_status !== OfferStatus.APPROVED) {
      throw new ConflictException('Offer must be fully approved before sending');
    }
  }

  private assertWithdrawable(offer: Offer): void {
    if (TERMINAL_STATUSES.has(offer.offer_status)) {
      throw new ConflictException(`Cannot withdraw an offer with status: ${offer.offer_status}`);
    }
    if (offer.offer_status === OfferStatus.WITHDRAWN) {
      throw new ConflictException('Offer is already withdrawn');
    }
  }

  private isSent(offer: Offer): boolean {
    return [OfferStatus.SENT, OfferStatus.VIEWED, OfferStatus.NEGOTIATING].includes(offer.offer_status);
  }

  private flattenDetails(dto: {
    template_id?: string;
    details?: { position?: string; department_id?: string; designation_id?: string; employment_type?: any; joining_date?: string; reporting_manager_id?: string; work_mode?: any; work_location?: string; office_address?: string; probation_days?: number; notice_period_days?: number };
    compensation?: { salary_structure_id?: string; ctc_annual?: number; monthly_take_home?: number; salary_components?: any[] };
    policy_ids?: string[];
  }): Partial<Offer> {
    const d = dto.details ?? {};
    const c = dto.compensation ?? {};
    return {
      position: d.position,
      department_id: d.department_id,
      designation_id: d.designation_id,
      employment_type: d.employment_type,
      joining_date: d.joining_date ? new Date(d.joining_date) : undefined,
      reporting_manager_id: d.reporting_manager_id,
      work_mode: d.work_mode,
      work_location: d.work_location,
      office_address: d.office_address,
      probation_days: d.probation_days,
      notice_period_days: d.notice_period_days,
      salary_structure_id: c.salary_structure_id,
      ctc_annual: c.ctc_annual,
      monthly_take_home: c.monthly_take_home,
      salary_components: c.salary_components ?? [],
      policy_ids: dto.policy_ids ?? [],
    };
  }
}
