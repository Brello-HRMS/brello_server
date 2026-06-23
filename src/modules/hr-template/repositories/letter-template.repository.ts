import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LetterTemplate } from '../entities/letter-template.entity';

@Injectable()
export class LetterTemplateRepository {
  constructor(
    @InjectRepository(LetterTemplate)
    private readonly repo: Repository<LetterTemplate>,
  ) {}

  async findAll(orgId: string, categoryId?: string): Promise<LetterTemplate[]> {
    const qb = this.repo
      .createQueryBuilder('tpl')
      .leftJoinAndSelect('tpl.category', 'category')
      .where('tpl.is_deleted = :del', { del: false })
      .andWhere('(tpl.organization_id = :orgId OR tpl.is_system = true)', { orgId });

    if (categoryId) {
      qb.andWhere('tpl.category_id = :categoryId', { categoryId });
    }

    return qb
      .orderBy('tpl.is_system', 'DESC')
      .addOrderBy('tpl.name', 'ASC')
      .getMany();
  }

  /** Find a single template visible to the org (own OR system). */
  async findOrgAccessible(id: string, orgId: string): Promise<LetterTemplate | null> {
    return this.repo
      .createQueryBuilder('tpl')
      .leftJoinAndSelect('tpl.category', 'category')
      .where('tpl.id = :id AND tpl.is_deleted = false', { id })
      .andWhere('(tpl.organization_id = :orgId OR tpl.is_system = true)', { orgId })
      .getOne();
  }

  /** Soft-delete all non-system templates owned by the org in a given category. */
  async softDeleteByCategory(categoryId: string, orgId: string): Promise<void> {
    await this.repo
      .createQueryBuilder()
      .update(LetterTemplate)
      .set({ is_deleted: true })
      .where(
        'category_id = :categoryId AND organization_id = :orgId AND is_deleted = false AND is_system = false',
        { categoryId, orgId },
      )
      .execute();
  }

  async create(data: Partial<LetterTemplate>): Promise<LetterTemplate> {
    const entity = this.repo.create(data);
    return this.repo.save(entity);
  }

  async update(id: string, data: Partial<LetterTemplate>, orgId: string): Promise<LetterTemplate | null> {
    await this.repo.update(id, data);
    return this.findOrgAccessible(id, orgId);
  }

  async softDelete(id: string): Promise<void> {
    await this.repo.update(id, { is_deleted: true });
  }
}
