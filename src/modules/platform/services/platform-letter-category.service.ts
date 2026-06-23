import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LetterCategory } from '../../hr-template/entities/letter-category.entity';
import { CreateLetterCategoryDto, UpdateLetterCategoryDto } from '../../hr-template/dto/letter-category.dto';
import { AuditContextService } from '../../audit/services/audit-context.service';

@Injectable()
export class PlatformLetterCategoryService {
  private readonly logger = new Logger(PlatformLetterCategoryService.name);

  constructor(
    @InjectRepository(LetterCategory)
    private readonly repository: Repository<LetterCategory>,
    private readonly auditContext: AuditContextService,
  ) {}

  async findAll(): Promise<LetterCategory[]> {
    return this.repository.find({
      where: { is_system: true, is_deleted: false },
      order: { name: 'ASC' },
    });
  }

  async findOne(id: string): Promise<LetterCategory> {
    const category = await this.repository.findOne({
      where: { id, is_system: true, is_deleted: false },
    });
    if (!category) {
      throw new NotFoundException(`Platform letter category "${id}" not found`);
    }
    return category;
  }

  async create(dto: CreateLetterCategoryDto): Promise<LetterCategory> {
    this.logger.log(`Creating platform letter category: ${dto.name}`);
    const entity = this.repository.create({
      name: dto.name,
      description: dto.description,
      is_system: true,
      is_deleted: false,
    });
    return this.repository.save(entity);
  }

  async update(id: string, dto: UpdateLetterCategoryDto): Promise<LetterCategory> {
    const existing = await this.findOne(id);
    
    this.auditContext.setPreValue(existing as unknown as Record<string, unknown>);
    this.logger.log(`Updating platform letter category ${id}`);
    
    await this.repository.update(id, dto);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const existing = await this.findOne(id);
    this.auditContext.setPreValue(existing as unknown as Record<string, unknown>);
    
    // Note: To be fully safe, we should also soft-delete related templates,
    // but typically a soft-delete handles just the entity.
    this.logger.log(`Soft-deleting platform letter category ${id}`);
    await this.repository.update(id, { is_deleted: true });
  }
}
