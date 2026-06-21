import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { LetterCategoryRepository } from '../repositories/letter-category.repository';
import { LetterTemplateRepository } from '../repositories/letter-template.repository';
import { CreateLetterCategoryDto, UpdateLetterCategoryDto } from '../dto/letter-category.dto';
import { LetterCategory } from '../entities/letter-category.entity';
import type { LoggedInUser } from '../../auth/interfaces/logged-in-user.interface';
import type { DocumentType } from '../entities/letter-category.entity';
import { AuditContextService } from '../../audit/services/audit-context.service';

@Injectable()
export class LetterCategoryService {
  private readonly logger = new Logger(LetterCategoryService.name);

  constructor(
    private readonly repository: LetterCategoryRepository,
    private readonly templateRepository: LetterTemplateRepository,
    private readonly auditContext: AuditContextService,
  ) {}

  private assertOrgContext(user: LoggedInUser): void {
    if (!user.organizationId) {
      throw new BadRequestException('No organisation context found on this token');
    }
  }

  async findAll(user: LoggedInUser, documentType?: DocumentType): Promise<LetterCategory[]> {
    this.assertOrgContext(user);
    return this.repository.findAll(user.organizationId, documentType);
  }

  /** GET /:id — returns the category only if visible to the caller's org. */
  async findOne(user: LoggedInUser, id: string): Promise<LetterCategory> {
    this.assertOrgContext(user);
    const category = await this.repository.findOrgAccessible(id, user.organizationId);
    if (!category) {
      throw new NotFoundException(`Letter category "${id}" not found`);
    }
    return category;
  }

  async create(user: LoggedInUser, dto: CreateLetterCategoryDto): Promise<LetterCategory> {
    this.assertOrgContext(user);
    this.logger.log(`Creating letter category: ${dto.name} for org ${user.organizationId}`);
    return this.repository.create({
      name: dto.name,
      description: dto.description,
      document_type: dto.document_type,
      organization_id: user.organizationId,
      enterprise_id: user.enterpriseId,
      is_system: false,
      is_deleted: false,
    });
  }

  async update(
    user: LoggedInUser,
    id: string,
    dto: UpdateLetterCategoryDto,
  ): Promise<LetterCategory | null> {
    this.assertOrgContext(user);

    const existing = await this.repository.findOrgAccessible(id, user.organizationId);
    if (!existing) {
      throw new NotFoundException(`Letter category "${id}" not found`);
    }
    if (existing.is_system) {
      throw new ForbiddenException('System categories cannot be modified');
    }
    if (existing.organization_id !== user.organizationId) {
      throw new ForbiddenException('You do not have permission to update this category');
    }

    this.auditContext.setPreValue(existing as unknown as Record<string, unknown>);
    this.logger.log(`Updating letter category ${id}`);
    return this.repository.update(id, dto);
  }

  async remove(user: LoggedInUser, id: string): Promise<void> {
    this.assertOrgContext(user);

    const existing = await this.repository.findOrgAccessible(id, user.organizationId);
    if (!existing) {
      throw new NotFoundException(`Letter category "${id}" not found`);
    }
    if (existing.is_system) {
      throw new ForbiddenException('System categories cannot be deleted');
    }
    if (existing.organization_id !== user.organizationId) {
      throw new ForbiddenException('You do not have permission to delete this category');
    }

    this.auditContext.setPreValue(existing as unknown as Record<string, unknown>);

    // Cascade soft-delete all org-owned templates in this category before deleting the category
    await this.templateRepository.softDeleteByCategory(id, user.organizationId);

    this.logger.log(`Soft-deleting letter category ${id}`);
    await this.repository.softDelete(id);
  }
}
