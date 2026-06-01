import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { LetterTemplateRepository } from '../repositories/letter-template.repository';
import { LetterCategoryRepository } from '../repositories/letter-category.repository';
import {
  CreateLetterTemplateDto,
  UpdateLetterTemplateDto,
} from '../dto/letter-template.dto';
import { LetterTemplate } from '../entities/letter-template.entity';

@Injectable()
export class LetterTemplateService {
  private readonly logger = new Logger(LetterTemplateService.name);

  constructor(
    private readonly repository: LetterTemplateRepository,
    private readonly categoryRepository: LetterCategoryRepository,
  ) {}

  private extractVariables(content: string): string[] {
    const matches = content.match(/\{\{([^}]+)\}\}/g) ?? [];
    return [...new Set(matches.map((m: string) => m.slice(2, -2).trim()))];
  }

  async findAll(categoryId?: string): Promise<LetterTemplate[]> {
    return this.repository.findAll(categoryId);
  }

  async findOne(id: string): Promise<LetterTemplate> {
    const template = await this.repository.findById(id);
    if (!template) {
      throw new NotFoundException(`Letter template with ID "${id}" not found`);
    }
    return template;
  }

  async create(dto: CreateLetterTemplateDto): Promise<LetterTemplate> {
    const category = await this.categoryRepository.findById(dto.category_id);
    if (!category) {
      throw new NotFoundException(
        `Letter category with ID "${dto.category_id}" not found`,
      );
    }

    const content = dto.content ?? '';
    const variables = dto.variables ?? this.extractVariables(content);

    this.logger.log(
      `Creating letter template "${dto.name}" in category ${dto.category_id}`,
    );
    return this.repository.create({
      category_id: dto.category_id,
      name: dto.name,
      subject: dto.subject,
      description: dto.description,
      content,
      variables,
      design: dto.design ?? null,
      is_system: true,
      is_deleted: false,
    });
  }

  async update(
    id: string,
    dto: UpdateLetterTemplateDto,
  ): Promise<LetterTemplate | null> {
    await this.findOne(id);

    const updateData: Partial<LetterTemplate> = { ...dto };
    if (dto.content !== undefined) {
      updateData.variables =
        dto.variables ?? this.extractVariables(dto.content);
    }

    this.logger.log(`Updating letter template ${id}`);
    return this.repository.update(id, updateData);
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    this.logger.log(`Soft-deleting letter template ${id}`);
    await this.repository.softDelete(id);
  }
}
