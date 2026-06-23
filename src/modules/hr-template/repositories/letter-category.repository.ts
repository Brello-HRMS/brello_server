import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LetterCategory } from '../entities/letter-category.entity';
import type { DocumentType } from '../entities/letter-category.entity';

@Injectable()
export class LetterCategoryRepository {
  constructor(
    @InjectRepository(LetterCategory)
    private readonly repo: Repository<LetterCategory>,
  ) {}

  async findAll(orgId: string, documentType?: DocumentType): Promise<LetterCategory[]> {
    const qb = this.repo
      .createQueryBuilder('cat')
      .where('cat.is_deleted = :del', { del: false })
      .andWhere('(cat.organization_id = :orgId OR cat.is_system = true)', { orgId });

    if (documentType) {
      qb.andWhere('cat.document_type = :documentType', { documentType });
    }

    return qb.orderBy('cat.is_system', 'DESC').addOrderBy('cat.name', 'ASC').getMany();
  }

  async findById(id: string): Promise<LetterCategory | null> {
    return this.repo.findOne({ where: { id, is_deleted: false } });
  }

  /** Find a category visible to the org (own OR system). */
  async findOrgAccessible(id: string, orgId: string): Promise<LetterCategory | null> {
    return this.repo
      .createQueryBuilder('cat')
      .where('cat.id = :id AND cat.is_deleted = false', { id })
      .andWhere('(cat.organization_id = :orgId OR cat.is_system = true)', { orgId })
      .getOne();
  }

  async findOneByOrg(id: string, orgId: string): Promise<LetterCategory | null> {
    return this.repo.findOne({
      where: { id, organization_id: orgId, is_deleted: false },
    });
  }

  async create(data: Partial<LetterCategory>): Promise<LetterCategory> {
    const entity = this.repo.create(data);
    return this.repo.save(entity);
  }

  async update(id: string, data: Partial<LetterCategory>): Promise<LetterCategory | null> {
    await this.repo.update(id, data);
    return this.findById(id);
  }

  async softDelete(id: string): Promise<void> {
    await this.repo.update(id, { is_deleted: true });
  }
}
