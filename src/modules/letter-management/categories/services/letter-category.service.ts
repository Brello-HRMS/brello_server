import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { LetterCategoryRepository } from '../repositories/letter-category.repository';
import { LetterCategory } from '../entities/letter-category.entity';
import { CreateLetterCategoryDto, UpdateLetterCategoryDto } from '../dto/letter-category.dto';
import { LoggedInUser } from '../../../auth/interfaces/logged-in-user.interface';
import { Status } from '../../../../common/enums';
import { AuditContextService } from '../../../audit/services/audit-context.service';

@Injectable()
export class LetterCategoryService {
  private readonly logger = new Logger(LetterCategoryService.name);

  constructor(
    private readonly categoryRepository: LetterCategoryRepository,
    private readonly auditContext: AuditContextService,
  ) {}

  async create(user: LoggedInUser, dto: CreateLetterCategoryDto): Promise<LetterCategory> {
    this.logger.log(`User ${user.userId} is creating letter category: ${dto.name}`);

    const existing = await this.categoryRepository.findByName(user.organizationId, dto.name);
    if (existing) {
      throw new ConflictException(
        `Letter category with name '${dto.name}' already exists in this organization`,
      );
    }

    return this.categoryRepository.create({
      ...dto,
      organization_id: user.organizationId,
      enterprise_id: user.enterpriseId,
      modified_by: user.userId,
      status: Status.ACTIVE,
    });
  }

  async findAll(
    user: LoggedInUser,
    filters: { status?: Status; search?: string } = {},
  ): Promise<LetterCategory[]> {
    this.logger.log(`User ${user.userId} is listing letter categories`);
    return this.categoryRepository.findAllByOrg(user.organizationId, filters);
  }

  async findOne(user: LoggedInUser, id: string): Promise<LetterCategory> {
    const category = await this.categoryRepository.findOneByOrg(id, user.organizationId);

    if (!category) {
      throw new NotFoundException(`Letter category with ID '${id}' not found`);
    }

    return category;
  }

  async update(
    user: LoggedInUser,
    id: string,
    dto: UpdateLetterCategoryDto,
  ): Promise<LetterCategory> {
    const existing = await this.findOne(user, id);
    this.auditContext.setPreValue(existing as unknown as Record<string, unknown>);

    const updated = await this.categoryRepository.update(id, {
      ...dto,
      modified_by: user.userId,
    });

    if (!updated) {
      throw new NotFoundException(`Letter category with ID '${id}' not found after update`);
    }

    return updated;
  }

  async archive(user: LoggedInUser, id: string): Promise<LetterCategory> {
    const existing = await this.findOne(user, id);
    this.auditContext.setPreValue(existing as unknown as Record<string, unknown>);

    const publishedCount = await this.categoryRepository.countPublishedTemplatesByCategory(id);
    if (publishedCount > 0) {
      throw new ConflictException(
        'Cannot archive a category with published templates. Archive or reassign its templates first.',
      );
    }

    const updated = await this.categoryRepository.update(id, {
      status: Status.ARCHIVED,
      modified_by: user.userId,
    });

    if (!updated) {
      throw new NotFoundException(`Letter category with ID '${id}' not found after archive`);
    }

    return updated;
  }
}
