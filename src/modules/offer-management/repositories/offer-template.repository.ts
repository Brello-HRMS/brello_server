import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OfferTemplate } from '../entities/offer-template.entity';
import { OfferTemplateStatus } from '../enums/offer-template-status.enum';

export interface OfferTemplateFilters {
  template_status?: OfferTemplateStatus;
  search?: string;
}

@Injectable()
export class OfferTemplateRepository {
  constructor(
    @InjectRepository(OfferTemplate)
    private readonly repo: Repository<OfferTemplate>,
  ) {}

  async create(data: Partial<OfferTemplate>): Promise<OfferTemplate> {
    const template = this.repo.create(data);
    return this.repo.save(template);
  }

  async findAllByOrg(
    organizationId: string,
    filters: OfferTemplateFilters = {},
  ): Promise<OfferTemplate[]> {
    const qb = this.repo
      .createQueryBuilder('t')
      .where('t.organization_id = :organizationId', { organizationId });

    if (filters.template_status) {
      qb.andWhere('t.template_status = :status', { status: filters.template_status });
    }
    if (filters.search) {
      qb.andWhere('t.name ILIKE :search', { search: `%${filters.search}%` });
    }

    return qb.orderBy('t.updated_at', 'DESC').getMany();
  }

  async findOneByOrg(id: string, organizationId: string): Promise<OfferTemplate | null> {
    return this.repo.findOne({ where: { id, organization_id: organizationId } });
  }

  async findById(id: string): Promise<OfferTemplate | null> {
    return this.repo.findOne({ where: { id } });
  }

  async findPublishedByOrg(id: string, organizationId: string): Promise<OfferTemplate | null> {
    return this.repo.findOne({
      where: { id, organization_id: organizationId, template_status: OfferTemplateStatus.PUBLISHED },
    });
  }

  async update(id: string, data: Partial<OfferTemplate>): Promise<OfferTemplate | null> {
    await this.repo.update(id, data);
    return this.repo.findOne({ where: { id } });
  }
}
