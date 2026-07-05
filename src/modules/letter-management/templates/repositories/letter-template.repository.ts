import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LetterTemplate } from '../entities/letter-template.entity';
import { TemplateStatus } from '../enums/template-status.enum';

@Injectable()
export class LetterTemplateRepository {
  constructor(
    @InjectRepository(LetterTemplate)
    private readonly repo: Repository<LetterTemplate>,
  ) {}

  async create(data: Partial<LetterTemplate>): Promise<LetterTemplate> {
    const template = this.repo.create(data);
    return this.repo.save(template);
  }

  async findAllByOrg(
    organizationId: string,
    filters: {
      category_id?: string;
      template_status?: TemplateStatus;
      search?: string;
    } = {},
  ): Promise<LetterTemplate[]> {
    const { category_id, template_status, search } = filters;

    const queryBuilder = this.repo
      .createQueryBuilder('template')
      .where('template.organization_id = :organizationId', { organizationId });

    if (category_id) {
      queryBuilder.andWhere('template.category_id = :category_id', { category_id });
    }

    if (template_status) {
      queryBuilder.andWhere('template.template_status = :template_status', { template_status });
    }

    if (search) {
      queryBuilder.andWhere('template.name ILIKE :search', { search: `%${search}%` });
    }

    queryBuilder.orderBy('template.updated_at', 'DESC');

    return queryBuilder.getMany();
  }

  async findOneByOrg(id: string, organizationId: string): Promise<LetterTemplate | null> {
    return this.repo.findOne({
      where: { id, organization_id: organizationId },
    });
  }

  async update(id: string, data: Partial<LetterTemplate>): Promise<LetterTemplate | null> {
    await this.repo.update(id, data);
    return this.repo.findOne({ where: { id } });
  }

  /** Used only by IssuedLetterService to confirm the template is still PUBLISHED at generation time. */
  async findPublishedByOrg(id: string, organizationId: string): Promise<LetterTemplate | null> {
    return this.repo.findOne({
      where: { id, organization_id: organizationId, template_status: TemplateStatus.PUBLISHED },
    });
  }
}
