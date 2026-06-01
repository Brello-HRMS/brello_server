import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { LetterCategoryRepository } from '../repositories/letter-category.repository';
import { CreateLetterCategoryDto, UpdateLetterCategoryDto } from '../dto/letter-category.dto';
import { LetterCategory } from '../entities/letter-category.entity';
import type { DocumentType } from '../entities/letter-category.entity';

@Injectable()
export class LetterCategoryService {
  private readonly logger = new Logger(LetterCategoryService.name);

  constructor(private readonly repository: LetterCategoryRepository) {}

  async findAll(documentType?: DocumentType): Promise<LetterCategory[]> {
    return this.repository.findAll(documentType);
  }

  async findOne(id: string): Promise<LetterCategory> {
    const category = await this.repository.findById(id);
    if (!category) {
      throw new NotFoundException(`Letter category with ID "${id}" not found`);
    }
    return category;
  }

  async create(dto: CreateLetterCategoryDto): Promise<LetterCategory> {
    this.logger.log(`Creating letter category: ${dto.name}`);
    return this.repository.create({
      name: dto.name,
      description: dto.description,
      document_type: dto.document_type,
      is_system: true,
      is_deleted: false,
    });
  }

  async update(id: string, dto: UpdateLetterCategoryDto): Promise<LetterCategory | null> {
    await this.findOne(id);
    this.logger.log(`Updating letter category ${id}`);
    return this.repository.update(id, dto);
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    this.logger.log(`Soft-deleting letter category ${id}`);
    await this.repository.softDelete(id);
  }
}
