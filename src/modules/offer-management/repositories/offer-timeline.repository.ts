import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OfferTimeline } from '../entities/offer-timeline.entity';
import { OfferTimelineEvent } from '../enums/offer-timeline-event.enum';

export interface TimelineEntryData {
  offer_id: string;
  offer_version_id?: string;
  event: OfferTimelineEvent;
  label: string;
  metadata?: Record<string, unknown>;
  actor_id?: string;
  actor_name?: string;
  organization_id: string;
  enterprise_id: string;
}

@Injectable()
export class OfferTimelineRepository {
  constructor(
    @InjectRepository(OfferTimeline)
    private readonly repo: Repository<OfferTimeline>,
  ) {}

  async record(data: TimelineEntryData): Promise<OfferTimeline> {
    const entry = this.repo.create({
      offer_id: data.offer_id,
      offer_version_id: data.offer_version_id ?? null,
      event: data.event,
      label: data.label,
      metadata: data.metadata ?? null,
      actor_id: data.actor_id ?? null,
      actor_name: data.actor_name ?? null,
      organization_id: data.organization_id,
      enterprise_id: data.enterprise_id,
    });
    return this.repo.save(entry);
  }

  async findByOffer(offerId: string): Promise<OfferTimeline[]> {
    return this.repo.find({
      where: { offer_id: offerId },
      order: { created_at: 'ASC' },
    });
  }

  async findByOfferAndOrg(offerId: string, organizationId: string): Promise<OfferTimeline[]> {
    return this.repo.find({
      where: { offer_id: offerId, organization_id: organizationId },
      order: { created_at: 'ASC' },
    });
  }
}
