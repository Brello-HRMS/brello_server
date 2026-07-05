import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LetterCategory } from '../entities/letter-category.entity';
import { Status } from '../../../../common/enums';
import { LetterTemplate } from '../../templates/entities/letter-template.entity';
import { TemplateStatus } from '../../templates/enums/template-status.enum';

@Injectable()
export class LetterCategoryRepository {
  constructor(
    @InjectRepository(LetterCategory)
    private readonly repo: Repository<LetterCategory>,
  ) {}

  async create(data: Partial<LetterCategory>): Promise<LetterCategory> {
    const category = this.repo.create(data);
    return this.repo.save(category);
  }

  async findAllByOrg(
    organizationId: string,
    filters: { status?: Status; search?: string } = {},
  ): Promise<LetterCategory[]> {
    const { status, search } = filters;

    const queryBuilder = this.repo
      .createQueryBuilder('category')
      .where('category.organization_id = :organizationId', { organizationId });

    if (status) {
      queryBuilder.andWhere('category.status = :status', { status });
    }

    if (search) {
      queryBuilder.andWhere('category.name ILIKE :search', { search: `%${search}%` });
    }

    queryBuilder.orderBy('category.name', 'ASC');

    return queryBuilder.getMany();
  }

  async findOneByOrg(id: string, organizationId: string): Promise<LetterCategory | null> {
    return this.repo.findOne({
      where: {
        id,
        organization_id: organizationId,
      },
    });
  }

  async findByName(organizationId: string, name: string): Promise<LetterCategory | null> {
    return this.repo
      .createQueryBuilder('category')
      .where('category.organization_id = :organizationId', { organizationId })
      .andWhere('category.name ILIKE :name', { name })
      .getOne();
  }

  async update(id: string, data: Partial<LetterCategory>): Promise<LetterCategory | null> {
    await this.repo.update(id, data);
    return this.repo.findOne({ where: { id } });
  }

  /**
   * Counts published templates referencing this category, using the shared
   * EntityManager to reach the Templates entity directly. This deliberately
   * avoids a NestJS module dependency on Templates (no circular DI) — it's a
   * type-only import of the entity/enum, resolved at runtime via TypeORM's
   * global entity metadata rather than through an injected TemplatesModule.
   */
  async countPublishedTemplatesByCategory(categoryId: string): Promise<number> {
    return this.repo.manager
      .getRepository(LetterTemplate)
      .count({ where: { category_id: categoryId, template_status: TemplateStatus.PUBLISHED } });
  }
}
