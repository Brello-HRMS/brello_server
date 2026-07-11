import { Injectable } from '@nestjs/common';
import { OfferRepository } from '../repositories/offer.repository';
import { OfferTimelineRepository } from '../repositories/offer-timeline.repository';
import { OfferStatus } from '../enums/offer-status.enum';
import type { LoggedInUser } from '../../auth/interfaces/logged-in-user.interface';

export interface OfferAnalytics {
  total: number;
  by_status: Partial<Record<OfferStatus, number>>;
  acceptance_rate: number;
  negotiation_rate: number;
  avg_acceptance_days: number | null;
  timeline: OfferTimeline[];
}

interface OfferTimeline {
  event: string;
  label: string;
  created_at: string;
}

@Injectable()
export class OfferAnalyticsService {
  constructor(
    private readonly offerRepo: OfferRepository,
    private readonly timelineRepo: OfferTimelineRepository,
  ) {}

  async getAnalytics(user: LoggedInUser): Promise<OfferAnalytics> {
    const byStatus = await this.offerRepo.countByStatus(user.organizationId);
    const total = Object.values(byStatus).reduce((sum, n) => sum + n, 0);

    const accepted = byStatus[OfferStatus.ACCEPTED] ?? 0;
    const synced = byStatus[OfferStatus.SYNCED] ?? 0;
    const negotiating = byStatus[OfferStatus.NEGOTIATING] ?? 0;

    // Denominator = every offer that was actually sent to the candidate (i.e. every
    // status except the pre-send ones), so rejected/expired/withdrawn offers still
    // count against the rate instead of silently dropping out of both sides.
    const draft = byStatus[OfferStatus.DRAFT] ?? 0;
    const pendingApproval = byStatus[OfferStatus.PENDING_APPROVAL] ?? 0;
    const approved = byStatus[OfferStatus.APPROVED] ?? 0;
    const acceptanceDenominator = total - draft - pendingApproval - approved || 1;

    const acceptance_rate = Math.round(((accepted + synced) / acceptanceDenominator) * 100);
    const negotiation_rate = Math.round((negotiating / acceptanceDenominator) * 100);

    return {
      total,
      by_status: byStatus,
      acceptance_rate,
      negotiation_rate,
      avg_acceptance_days: null, // TODO: compute from timeline
      timeline: [],
    };
  }
}
