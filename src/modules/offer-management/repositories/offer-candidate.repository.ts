import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OfferCandidate } from '../entities/offer-candidate.entity';

export interface CandidateFilters {
  search?: string;
  recruiter_id?: string;
}

@Injectable()
export class OfferCandidateRepository {
  constructor(
    @InjectRepository(OfferCandidate)
    private readonly repo: Repository<OfferCandidate>,
  ) {}

  async create(data: Partial<OfferCandidate>): Promise<OfferCandidate> {
    const candidate = this.repo.create(data);
    return this.repo.save(candidate);
  }

  async findAllByOrg(
    organizationId: string,
    filters: CandidateFilters = {},
  ): Promise<OfferCandidate[]> {
    const qb = this.repo
      .createQueryBuilder('c')
      .where('c.organization_id = :organizationId', { organizationId });

    if (filters.search) {
      qb.andWhere(
        '(c.first_name ILIKE :q OR c.last_name ILIKE :q OR c.email ILIKE :q OR c.applied_for ILIKE :q)',
        { q: `%${filters.search}%` },
      );
    }

    if (filters.recruiter_id) {
      qb.andWhere('c.recruiter_id = :recruiterId', { recruiterId: filters.recruiter_id });
    }

    return qb.orderBy('c.created_at', 'DESC').getMany();
  }

  async findOneByOrg(id: string, organizationId: string): Promise<OfferCandidate | null> {
    return this.repo.findOne({ where: { id, organization_id: organizationId } });
  }

  async findById(id: string): Promise<OfferCandidate | null> {
    return this.repo.findOne({ where: { id } });
  }

  async findByEmailAndOrg(email: string, organizationId: string): Promise<OfferCandidate | null> {
    return this.repo.findOne({ where: { email, organization_id: organizationId } });
  }

  async update(id: string, data: Partial<OfferCandidate>): Promise<OfferCandidate | null> {
    await this.repo.update(id, data);
    return this.repo.findOne({ where: { id } });
  }
}
