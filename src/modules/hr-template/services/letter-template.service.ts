import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { LetterTemplateRepository } from '../repositories/letter-template.repository';
import { LetterCategoryRepository } from '../repositories/letter-category.repository';
import {
  CreateLetterTemplateDto,
  UpdateLetterTemplateDto,
} from '../dto/letter-template.dto';
import { LetterTemplate } from '../entities/letter-template.entity';
import type { LoggedInUser } from '../../auth/interfaces/logged-in-user.interface';

@Injectable()
export class LetterTemplateService {
  private readonly logger = new Logger(LetterTemplateService.name);

  constructor(
    private readonly repository: LetterTemplateRepository,
    private readonly categoryRepository: LetterCategoryRepository,
  ) {}

  private assertOrgContext(user: LoggedInUser): void {
    if (!user.organizationId) {
      throw new BadRequestException('No organisation context found on this token');
    }
  }

  /** Extract {{word}} variable keys from template content. */
  private extractVariables(content: string): string[] {
    const matches = content.match(/\{\{(\w+)\}\}/g) ?? [];
    return [...new Set(matches.map((m) => m.slice(2, -2)))];
  }

  async findAll(user: LoggedInUser, categoryId?: string): Promise<LetterTemplate[]> {
    this.assertOrgContext(user);
    return this.repository.findAll(user.organizationId, categoryId);
  }

  /** GET /:id — returns the template only if visible to the caller's org. */
  async findOne(user: LoggedInUser, id: string): Promise<LetterTemplate> {
    this.assertOrgContext(user);
    const template = await this.repository.findOrgAccessible(id, user.organizationId);
    if (!template) {
      throw new NotFoundException(`Letter template "${id}" not found`);
    }
    return template;
  }

  async create(user: LoggedInUser, dto: CreateLetterTemplateDto): Promise<LetterTemplate> {
    this.assertOrgContext(user);

    const category = await this.categoryRepository.findOrgAccessible(
      dto.category_id,
      user.organizationId,
    );
    if (!category) {
      throw new NotFoundException(`Letter category "${dto.category_id}" not found`);
    }

    const content = dto.content ?? '';
    const variables = dto.variables ?? this.extractVariables(content);

    this.logger.log(
      `Creating letter template "${dto.name}" in category ${dto.category_id} for org ${user.organizationId}`,
    );
    return this.repository.create({
      category_id: dto.category_id,
      name: dto.name,
      subject: dto.subject,
      description: dto.description,
      content,
      variables,
      design: dto.design ?? null,
      organization_id: user.organizationId,
      enterprise_id: user.enterpriseId,
      is_system: false,
      is_deleted: false,
    });
  }

  async update(
    user: LoggedInUser,
    id: string,
    dto: UpdateLetterTemplateDto,
  ): Promise<LetterTemplate | null> {
    this.assertOrgContext(user);

    // Single query: org-accessible record
    const existing = await this.repository.findOrgAccessible(id, user.organizationId);
    if (!existing) {
      throw new NotFoundException(`Letter template "${id}" not found`);
    }
    if (existing.is_system) {
      throw new ForbiddenException('System templates cannot be modified');
    }
    // After the above checks, existing.organization_id must equal user.organizationId
    if (existing.organization_id !== user.organizationId) {
      throw new ForbiddenException('You do not have permission to update this template');
    }

    // Validate new category belongs to org when provided
    if (dto.category_id) {
      const category = await this.categoryRepository.findOrgAccessible(
        dto.category_id,
        user.organizationId,
      );
      if (!category) {
        throw new NotFoundException(`Letter category "${dto.category_id}" not found`);
      }
    }

    const updateData: Partial<LetterTemplate> = { ...dto };
    if (dto.content !== undefined) {
      updateData.variables = dto.variables ?? this.extractVariables(dto.content);
    }

    this.logger.log(`Updating letter template ${id}`);
    return this.repository.update(id, updateData, user.organizationId);
  }

  async remove(user: LoggedInUser, id: string): Promise<void> {
    this.assertOrgContext(user);

    const existing = await this.repository.findOrgAccessible(id, user.organizationId);
    if (!existing) {
      throw new NotFoundException(`Letter template "${id}" not found`);
    }
    if (existing.is_system) {
      throw new ForbiddenException('System templates cannot be deleted');
    }
    if (existing.organization_id !== user.organizationId) {
      throw new ForbiddenException('You do not have permission to delete this template');
    }

    this.logger.log(`Soft-deleting letter template ${id}`);
    await this.repository.softDelete(id);
  }
}
