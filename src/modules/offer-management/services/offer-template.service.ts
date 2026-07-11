import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { OfferTemplateRepository } from '../repositories/offer-template.repository';
import { OfferTemplate } from '../entities/offer-template.entity';
import { OfferTemplateStatus } from '../enums/offer-template-status.enum';
import { CreateOfferTemplateDto, UpdateOfferTemplateDto, FilterOfferTemplatesDto } from '../dto/offer-template.dto';
import type { LoggedInUser } from '../../auth/interfaces/logged-in-user.interface';

@Injectable()
export class OfferTemplateService {
  constructor(private readonly templateRepo: OfferTemplateRepository) {}

  async create(user: LoggedInUser, dto: CreateOfferTemplateDto): Promise<OfferTemplate> {
    const variables = this.extractVariables(dto.body ?? '');
    return this.templateRepo.create({
      name: dto.name,
      body: dto.body ?? null,
      signatory_id: dto.signatory_id ?? null,
      include_salary_table: dto.include_salary_table ?? true,
      variables,
      version: 1,
      template_status: OfferTemplateStatus.DRAFT,
      organization_id: user.organizationId,
      enterprise_id: user.enterpriseId,
      modified_by: user.userId,
    });
  }

  async findAll(user: LoggedInUser, filters: FilterOfferTemplatesDto): Promise<OfferTemplate[]> {
    return this.templateRepo.findAllByOrg(user.organizationId, filters);
  }

  async findOne(user: LoggedInUser, id: string): Promise<OfferTemplate> {
    const template = await this.templateRepo.findOneByOrg(id, user.organizationId);
    if (!template) throw new NotFoundException(`Offer template "${id}" not found`);
    return template;
  }

  async update(user: LoggedInUser, id: string, dto: UpdateOfferTemplateDto): Promise<OfferTemplate> {
    const existing = await this.findOne(user, id);
    this.assertNotArchived(existing);

    const body = dto.body ?? existing.body ?? '';
    const variables = this.extractVariables(body);
    const versionBump = existing.template_status === OfferTemplateStatus.PUBLISHED ? 1 : 0;

    const updated = await this.templateRepo.update(id, {
      ...dto,
      variables,
      version: existing.version + versionBump,
      modified_by: user.userId,
    });
    if (!updated) throw new NotFoundException(`Offer template "${id}" not found after update`);
    return updated;
  }

  async publish(user: LoggedInUser, id: string): Promise<OfferTemplate> {
    const existing = await this.findOne(user, id);
    if (existing.template_status !== OfferTemplateStatus.DRAFT) {
      throw new ConflictException('Only draft templates can be published');
    }

    const updated = await this.templateRepo.update(id, {
      template_status: OfferTemplateStatus.PUBLISHED,
      modified_by: user.userId,
    });
    if (!updated) throw new NotFoundException(`Offer template "${id}" not found after publish`);
    return updated;
  }

  async archive(user: LoggedInUser, id: string): Promise<OfferTemplate> {
    await this.findOne(user, id);
    const updated = await this.templateRepo.update(id, {
      template_status: OfferTemplateStatus.ARCHIVED,
      modified_by: user.userId,
    });
    if (!updated) throw new NotFoundException(`Offer template "${id}" not found after archive`);
    return updated;
  }

  async duplicate(user: LoggedInUser, id: string): Promise<OfferTemplate> {
    const existing = await this.findOne(user, id);
    return this.templateRepo.create({
      name: `${existing.name} (Copy)`,
      body: existing.body,
      signatory_id: existing.signatory_id,
      include_salary_table: existing.include_salary_table,
      variables: existing.variables,
      version: 1,
      template_status: OfferTemplateStatus.DRAFT,
      organization_id: user.organizationId,
      enterprise_id: user.enterpriseId,
      modified_by: user.userId,
    });
  }

  private assertNotArchived(template: OfferTemplate): void {
    if (template.template_status === OfferTemplateStatus.ARCHIVED) {
      throw new ConflictException('Archived templates cannot be edited');
    }
  }

  private extractVariables(body: string): string[] {
    const matches = body.match(/\{\{(\w+)\}\}/g) ?? [];
    const keys = matches.map((m) => m.replace(/\{\{|\}\}/g, ''));
    return [...new Set(keys)];
  }
}
