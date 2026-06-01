import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LetterCategory } from '../entities/letter-category.entity';

@Injectable()
export class LetterCategoryRepository {
  constructor(
    @InjectRepository(LetterCategory)
    private readonly repo: Repository<LetterCategory>,
  ) {}

  async findAll(): Promise<LetterCategory[]> {
    return this.repo.find({
      where: { is_deleted: false },
      order: { name: 'ASC' },
    });
  }

  async findById(id: string): Promise<LetterCategory | null> {
    return this.repo.findOne({ where: { id, is_deleted: false } });
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
