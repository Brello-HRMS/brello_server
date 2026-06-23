import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LetterTemplate } from '../../hr-template/entities/letter-template.entity';
import { CreateLetterTemplateDto, UpdateLetterTemplateDto } from '../../hr-template/dto/letter-template.dto';
import { AuditContextService } from '../../audit/services/audit-context.service';

@Injectable()
export class PlatformLetterTemplateService {
  private readonly logger = new Logger(PlatformLetterTemplateService.name);

  constructor(
    @InjectRepository(LetterTemplate)
    private readonly repository: Repository<LetterTemplate>,
    private readonly auditContext: AuditContextService,
  ) {}

  async findAll(categoryId?: string): Promise<LetterTemplate[]> {
    const qb = this.repository
      .createQueryBuilder('tpl')
      .leftJoinAndSelect('tpl.category', 'category')
      .where('tpl.is_system = :isSystem', { isSystem: true })
      .andWhere('tpl.is_deleted = :del', { del: false });

    if (categoryId) {
      qb.andWhere('tpl.category_id = :categoryId', { categoryId });
    }

    return qb.orderBy('tpl.name', 'ASC').getMany();
  }

  async findOne(id: string): Promise<LetterTemplate> {
    const template = await this.repository.findOne({
      where: { id, is_system: true, is_deleted: false },
      relations: ['category'],
    });
    if (!template) {
      throw new NotFoundException(`Platform letter template "${id}" not found`);
    }
    return template;
  }

  async create(dto: CreateLetterTemplateDto): Promise<LetterTemplate> {
    this.logger.log(`Creating platform letter template: ${dto.name}`);
    const entity = this.repository.create({
      category_id: dto.category_id,
      name: dto.name,
      subject: dto.subject,
      content: dto.content,
      variables: dto.variables,
      design: dto.design,
      is_system: true,
      is_deleted: false,
    });
    return this.repository.save(entity);
  }

  async update(id: string, dto: UpdateLetterTemplateDto): Promise<LetterTemplate> {
    const existing = await this.findOne(id);
    
    this.auditContext.setPreValue(existing as unknown as Record<string, unknown>);
    this.logger.log(`Updating platform letter template ${id}`);
    
    await this.repository.update(id, dto);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const existing = await this.findOne(id);
    this.auditContext.setPreValue(existing as unknown as Record<string, unknown>);
    
    this.logger.log(`Soft-deleting platform letter template ${id}`);
    await this.repository.update(id, { is_deleted: true });
  }
}
