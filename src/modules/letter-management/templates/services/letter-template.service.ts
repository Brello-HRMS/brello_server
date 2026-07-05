import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { LetterTemplateRepository } from '../repositories/letter-template.repository';
import { LetterCategoryRepository } from '../../categories/repositories/letter-category.repository';
import { SignatoryRepository } from '../../signatories/repositories/signatory.repository';
import { LetterTemplate } from '../entities/letter-template.entity';
import { TemplateStatus } from '../enums/template-status.enum';
import {
  CreateLetterTemplateDto,
  UpdateLetterTemplateDto,
} from '../dto/letter-template.dto';
import { extractVariableKeys, isKnownVariable } from '../../shared/registry/variable-registry';
import { AuditContextService } from '../../../audit/services/audit-context.service';
import type { LoggedInUser } from '../../../auth/interfaces/logged-in-user.interface';

const SAMPLE_VALUES: Record<string, string> = {
  employee_name: 'John Doe',
  employee_code: 'EMP-0012',
  doj: '01 Jan 2026',
  designation: 'Software Engineer',
  department: 'Engineering',
  ctc: '7,20,000',
  organization_name: 'Acme Pvt Ltd',
  organization_address: '221B Baker Street, Bengaluru',
  today_date: new Date().toDateString(),
  letter_number: 'BRLO-2026-000001',
  signatory_name: 'Sarah Thomas',
  signatory_designation: 'HR Manager',
};

@Injectable()
export class LetterTemplateService {
  constructor(
    private readonly templateRepository: LetterTemplateRepository,
    private readonly categoryRepository: LetterCategoryRepository,
    private readonly signatoryRepository: SignatoryRepository,
    private readonly auditContext: AuditContextService,
  ) {}

  private fragments(dto: {
    heading?: string | null;
    paragraphs?: string[];
    bullet_list?: string[];
  }): string[] {
    return [dto.heading ?? '', ...(dto.paragraphs ?? []), ...(dto.bullet_list ?? [])];
  }

  /** Validates every {{placeholder}} used resolves against the Variable Registry. */
  private assertKnownVariables(keys: string[]): void {
    const unknown = keys.filter((k) => !isKnownVariable(k));
    if (unknown.length > 0) {
      throw new BadRequestException(
        `Unknown variable(s): ${unknown.map((k) => `{{${k}}}`).join(', ')}`,
      );
    }
  }

  private async assertCategoryAccessible(categoryId: string, organizationId: string) {
    const category = await this.categoryRepository.findOneByOrg(categoryId, organizationId);
    if (!category) {
      throw new NotFoundException(`Letter category "${categoryId}" not found`);
    }
    return category;
  }

  private async assertSignatoryAccessible(
    signatoryId: string | undefined,
    organizationId: string,
  ) {
    if (!signatoryId) return null;
    const signatory = await this.signatoryRepository.findOneByOrg(signatoryId, organizationId);
    if (!signatory) {
      throw new NotFoundException(`Signatory "${signatoryId}" not found`);
    }
    return signatory;
  }

  async create(user: LoggedInUser, dto: CreateLetterTemplateDto): Promise<LetterTemplate> {
    await this.assertCategoryAccessible(dto.category_id, user.organizationId);
    await this.assertSignatoryAccessible(dto.signatory_id, user.organizationId);

    const variables = extractVariableKeys(this.fragments(dto));
    this.assertKnownVariables(variables);

    return this.templateRepository.create({
      category_id: dto.category_id,
      name: dto.name,
      description: dto.description,
      heading: dto.heading ?? null,
      paragraphs: dto.paragraphs ?? [],
      bullet_list: dto.bullet_list ?? [],
      include_salary_table: dto.include_salary_table ?? false,
      signatory_id: dto.signatory_id ?? null,
      variables,
      version: 1,
      template_status: TemplateStatus.DRAFT,
      organization_id: user.organizationId,
      enterprise_id: user.enterpriseId,
      modified_by: user.userId,
    });
  }

  async findAll(
    user: LoggedInUser,
    filters?: { category_id?: string; template_status?: TemplateStatus; search?: string },
  ): Promise<LetterTemplate[]> {
    return this.templateRepository.findAllByOrg(user.organizationId, filters);
  }

  async findOne(user: LoggedInUser, id: string): Promise<LetterTemplate> {
    const template = await this.templateRepository.findOneByOrg(id, user.organizationId);
    if (!template) {
      throw new NotFoundException(`Letter template "${id}" not found`);
    }
    return template;
  }

  async update(
    user: LoggedInUser,
    id: string,
    dto: UpdateLetterTemplateDto,
  ): Promise<LetterTemplate> {
    const existing = await this.findOne(user, id);
    if (existing.template_status === TemplateStatus.ARCHIVED) {
      throw new ConflictException('Archived templates cannot be edited');
    }

    if (dto.category_id) {
      await this.assertCategoryAccessible(dto.category_id, user.organizationId);
    }
    if (dto.signatory_id) {
      await this.assertSignatoryAccessible(dto.signatory_id, user.organizationId);
    }

    this.auditContext.setPreValue(existing as unknown as Record<string, unknown>);

    const merged = {
      heading: dto.heading ?? existing.heading,
      paragraphs: dto.paragraphs ?? existing.paragraphs,
      bullet_list: dto.bullet_list ?? existing.bullet_list,
    };
    const variables = extractVariableKeys(this.fragments(merged));
    this.assertKnownVariables(variables);

    // Editing an already-published template bumps its version in place —
    // the immutability guarantee for issued letters comes entirely from
    // their own snapshot fields, not from freezing the template itself.
    const versionBump = existing.template_status === TemplateStatus.PUBLISHED ? 1 : 0;

    const updated = await this.templateRepository.update(id, {
      ...dto,
      variables,
      version: existing.version + versionBump,
      modified_by: user.userId,
    });
    if (!updated) {
      throw new NotFoundException(`Letter template "${id}" not found after update`);
    }
    return updated;
  }

  async publish(user: LoggedInUser, id: string): Promise<LetterTemplate> {
    const existing = await this.findOne(user, id);
    if (existing.template_status !== TemplateStatus.DRAFT) {
      throw new ConflictException('Only draft templates can be published');
    }
    if (!existing.heading && existing.paragraphs.length === 0) {
      throw new BadRequestException('Template must have a heading or at least one paragraph');
    }
    if (existing.signatory_id) {
      await this.assertSignatoryAccessible(existing.signatory_id, user.organizationId);
    }

    const variables = extractVariableKeys(this.fragments(existing));
    this.assertKnownVariables(variables);

    this.auditContext.setPreValue(existing as unknown as Record<string, unknown>);

    const updated = await this.templateRepository.update(id, {
      template_status: TemplateStatus.PUBLISHED,
      variables,
      modified_by: user.userId,
    });
    if (!updated) {
      throw new NotFoundException(`Letter template "${id}" not found after publish`);
    }
    return updated;
  }

  async duplicate(user: LoggedInUser, id: string): Promise<LetterTemplate> {
    const existing = await this.findOne(user, id);
    return this.templateRepository.create({
      category_id: existing.category_id,
      name: `${existing.name} (Copy)`,
      description: existing.description,
      heading: existing.heading,
      paragraphs: existing.paragraphs,
      bullet_list: existing.bullet_list,
      include_salary_table: existing.include_salary_table,
      signatory_id: existing.signatory_id,
      variables: existing.variables,
      version: 1,
      template_status: TemplateStatus.DRAFT,
      organization_id: user.organizationId,
      enterprise_id: user.enterpriseId,
      modified_by: user.userId,
    });
  }

  async archive(user: LoggedInUser, id: string): Promise<LetterTemplate> {
    const existing = await this.findOne(user, id);
    this.auditContext.setPreValue(existing as unknown as Record<string, unknown>);
    const updated = await this.templateRepository.update(id, {
      template_status: TemplateStatus.ARCHIVED,
      modified_by: user.userId,
    });
    if (!updated) {
      throw new NotFoundException(`Letter template "${id}" not found after archive`);
    }
    return updated;
  }

  /**
   * Sample-data preview (no employee, no DB writes beyond the read above).
   * NOTE: this uses a local substitution against fixed sample values rather
   * than the shared RenderModelBuilderService, since that service does not
   * yet exist at the point this method was authored. TODO: once
   * shared/services/render-model-builder.service.ts lands, refactor this to
   * delegate to it (same substitution, but reusable against real employee
   * data too) so preview and generate share one substitution implementation.
   */
  async preview(user: LoggedInUser, id: string) {
    const template = await this.findOne(user, id);
    const substitute = (text: string) =>
      text.replace(/\{\{(\w+)\}\}/g, (_match, key) => SAMPLE_VALUES[key] ?? `{{${key}}}`);

    return {
      heading: template.heading ? substitute(template.heading) : null,
      paragraphs: template.paragraphs.map(substitute),
      bulletList: template.bullet_list.map(substitute),
      salaryTable: template.include_salary_table
        ? {
            components: [
              { component_name: 'Basic', amount: 25000 },
              { component_name: 'HRA', amount: 15000 },
            ],
            total: 480000,
          }
        : null,
      signatory: template.signatory_id
        ? { name: SAMPLE_VALUES.signatory_name, designation: SAMPLE_VALUES.signatory_designation }
        : null,
    };
  }
}
