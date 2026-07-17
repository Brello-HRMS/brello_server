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
  async findNeedingReminder(daysBeforeExpiry: number): Promise<Offer[]> {
    return this.repo
      .createQueryBuilder('o')
      .where(`DATE(o.expires_at) = DATE(NOW() + INTERVAL '${daysBeforeExpiry} days')`)
      .andWhere('o.offer_status IN (:...statuses)', {
        statuses: [OfferStatus.SENT, OfferStatus.VIEWED],
      })
      .getMany();
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
}
