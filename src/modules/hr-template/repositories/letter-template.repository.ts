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

  async findAll(categoryId?: string): Promise<LetterTemplate[]> {
    const where: Record<string, unknown> = { is_deleted: false };
    if (categoryId) where.category_id = categoryId;
    return this.repo.find({
      where,
      relations: ['category'],
      order: { name: 'ASC' },
    });
  }

  async findById(id: string): Promise<LetterTemplate | null> {
    return this.repo.findOne({
      where: { id, is_deleted: false },
      relations: ['category'],
    });
  }

  async create(data: Partial<LetterTemplate>): Promise<LetterTemplate> {
    const entity = this.repo.create(data);
    return this.repo.save(entity);
  }

  async update(id: string, data: Partial<LetterTemplate>): Promise<LetterTemplate | null> {
    await this.repo.update(id, data);
    return this.findById(id);
  }

  async softDelete(id: string): Promise<void> {
    await this.repo.update(id, { is_deleted: true });
  }
}
