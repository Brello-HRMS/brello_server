import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Offer } from '../entities/offer.entity';
import { OfferStatus } from '../enums/offer-status.enum';

export interface OfferFilters {
  offer_status?: OfferStatus;
  candidate_id?: string;
  recruiter_id?: string;
  search?: string;
}

@Injectable()
export class OfferRepository {
  constructor(
    @InjectRepository(Offer)
    private readonly repo: Repository<Offer>,
  ) {}

  async create(data: Partial<Offer>): Promise<Offer> {
    const offer = this.repo.create(data);
    return this.repo.save(offer);
  }

  async findAllByOrg(
    organizationId: string,
    filters: OfferFilters = {},
    pagination: { page: number; limit: number } = { page: 1, limit: 10 },
  ): Promise<{ data: Offer[]; total: number }> {
    const qb = this.repo
      .createQueryBuilder('o')
      .leftJoinAndMapOne('o.candidate', 'offer_candidates', 'c', 'c.id = o.candidate_id')
      .where('o.organization_id = :organizationId', { organizationId });

    if (filters.offer_status) {
      qb.andWhere('o.offer_status = :status', { status: filters.offer_status });
    }
    if (filters.candidate_id) {
      qb.andWhere('o.candidate_id = :candidateId', { candidateId: filters.candidate_id });
    }

    const [data, total] = await qb
      .orderBy('o.updated_at', 'DESC')
      .skip((pagination.page - 1) * pagination.limit)
      .take(pagination.limit)
      .getManyAndCount();

    return { data, total };
  }

  async findOneByOrg(id: string, organizationId: string): Promise<Offer | null> {
    return this.repo.findOne({ where: { id, organization_id: organizationId } });
  }

  async findByCandidateAndOrg(
    candidateId: string,
    organizationId: string,
  ): Promise<Offer | null> {
    return this.repo.findOne({ where: { candidate_id: candidateId, organization_id: organizationId } });
  }

  async findById(id: string): Promise<Offer | null> {
    return this.repo.findOne({ where: { id } });
  }

  async update(id: string, data: Partial<Offer>): Promise<Offer | null> {
    await this.repo.update(id, data);
    return this.repo.findOne({ where: { id } });
  }

  /** Fetch all offers where expiry is past and status is still SENT/VIEWED. */
  async findExpired(): Promise<Offer[]> {
    return this.repo
      .createQueryBuilder('o')
      .where('o.expires_at < NOW()')
      .andWhere('o.offer_status IN (:...statuses)', {
        statuses: [OfferStatus.SENT, OfferStatus.VIEWED, OfferStatus.NEGOTIATING],
      })
      .getMany();
  }

  /** Fetch offers where reminders should be sent today. */
  async findNeedingReminder(daysBeforeExpiry: number): Promise<{ offer: Offer, candidate: any, activeVersion: any }[]> {
    const rows = await this.repo
      .createQueryBuilder('o')
      .leftJoinAndMapOne('o.candidate', 'offer_candidates', 'c', 'c.id = o.candidate_id')
      .leftJoinAndMapOne('o.activeVersion', 'offer_versions', 'v', 'v.offer_id = o.id AND v.is_active = true')
      .where(`DATE(o.expires_at) = DATE(NOW() + INTERVAL '${daysBeforeExpiry} days')`)
      .andWhere('o.offer_status IN (:...statuses)', {
        statuses: [OfferStatus.SENT, OfferStatus.VIEWED, OfferStatus.NEGOTIATING],
      })
      .getMany();
      
    // Return mapped objects so consumers have clear typings without needing 'any' if possible,
    // though getMany() will attach them to o.candidate and o.activeVersion.
    return rows.map(r => ({
      offer: r,
      candidate: (r as any).candidate || null,
      activeVersion: (r as any).activeVersion || null,
    }));
  }

  async countByStatus(organizationId: string): Promise<Record<OfferStatus, number>> {
    const rows = await this.repo
      .createQueryBuilder('o')
      .select('o.offer_status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('o.organization_id = :organizationId', { organizationId })
      .groupBy('o.offer_status')
      .getRawMany<{ status: OfferStatus; count: string }>();

    const result = {} as Record<OfferStatus, number>;
    for (const row of rows) {
      result[row.status] = parseInt(row.count, 10);
    }
    return result;
  }

  async countByWeek(organizationId: string, weeks: number): Promise<{ week: string; count: number }[]> {
    const rows = await this.repo
      .createQueryBuilder('o')
      .select("DATE_TRUNC('week', o.created_at)", 'week')
      .addSelect('COUNT(*)', 'count')
      .where('o.organization_id = :organizationId', { organizationId })
      .andWhere(`o.created_at >= NOW() - INTERVAL '${weeks} weeks'`)
      .groupBy("DATE_TRUNC('week', o.created_at)")
      .orderBy("DATE_TRUNC('week', o.created_at)", 'ASC')
      .getRawMany();
    
    return rows.map(r => ({
      week: new Date(r.week).toISOString(),
      count: parseInt(r.count, 10),
    }));
  }

  async avgAcceptanceDays(organizationId: string): Promise<number | null> {
    const result = await this.repo
      .createQueryBuilder('o')
      .select('AVG(EXTRACT(EPOCH FROM (o.accepted_at - o.sent_at)) / 86400)', 'avg_days')
      .where('o.organization_id = :organizationId', { organizationId })
      .andWhere('o.offer_status = :status', { status: OfferStatus.ACCEPTED })
      .andWhere('o.sent_at IS NOT NULL')
      .andWhere('o.accepted_at IS NOT NULL')
      .getRawOne();
      
    if (!result || result.avg_days === null) return null;
    return parseFloat(Number(result.avg_days).toFixed(1));
  }
}
