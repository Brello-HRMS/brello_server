import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SalaryTemplate } from '../entities/salary-template.entity';
import { SalaryTemplateComponent } from '../entities/salary-template-component.entity';
import { PayrollComponent } from '../entities/payroll-component.entity';
import { CreateSalaryTemplateDto } from '../dto/salary-template.dto';
import { ComponentMasterService } from './component-master.service';

const DEFAULT_COMPONENT_NAMES = ['CTC', 'Basic Salary', 'Special Allowance'];

@Injectable()
export class SalaryTemplateEngine {
  constructor(
    @InjectRepository(SalaryTemplate)
    private readonly templateRepository: Repository<SalaryTemplate>,
    @InjectRepository(SalaryTemplateComponent)
    private readonly templateComponentRepository: Repository<SalaryTemplateComponent>,
    @InjectRepository(PayrollComponent)
    private readonly componentRepository: Repository<PayrollComponent>,
    private readonly componentMasterService: ComponentMasterService,
  ) {}

  async createTemplate(
    enterpriseId: string,
    organizationId: string,
    dto: CreateSalaryTemplateDto,
  ): Promise<SalaryTemplate> {
    await this.componentMasterService.ensureDefaultComponents(enterpriseId, organizationId);

    const requestedIds = dto.components.map((c) => c.component_id);

    const dbComponents = await this.componentRepository.find({
      where: { enterprise_id: enterpriseId, organization_id: organizationId },
      relations: ['base_component'],
    });

    const allDefaults = dbComponents.filter((c) =>
      DEFAULT_COMPONENT_NAMES.includes(c.name),
    );

    // Merge defaults that were not explicitly included
    const defaultIdsToAdd = allDefaults
      .filter((d) => !requestedIds.includes(d.id))
      .map((d) => ({ component_id: d.id, sort_order: d.calculation_priority }));

    const finalComponentEntries = [
      ...dto.components,
      ...defaultIdsToAdd,
    ];

    const finalIds = finalComponentEntries.map((c) => c.component_id);

    const selectedComponents = dbComponents.filter((c) => finalIds.includes(c.id));

    if (selectedComponents.length !== finalIds.length) {
      throw new BadRequestException('One or more component IDs are invalid.');
    }

    this.validateDependencyGraph(selectedComponents, finalComponentEntries);

    const template = this.templateRepository.create({
      name: dto.name,
      description: dto.description,
      is_active: dto.is_active ?? true,
      enterprise_id: enterpriseId,
      organization_id: organizationId,
      components: finalComponentEntries.map((entry) => {
        const comp = selectedComponents.find((c) => c.id === entry.component_id)!;
        return {
          component_id: entry.component_id,
          override_config: (entry as any).override_config ?? null,
          sort_order: entry.sort_order ?? comp.calculation_priority,
          enterprise_id: enterpriseId,
          organization_id: organizationId,
        };
      }),
    });

    return this.templateRepository.save(template);
  }

  async getTemplateById(id: string): Promise<SalaryTemplate> {
    const template = await this.templateRepository.findOne({
      where: { id },
      relations: ['components', 'components.component', 'components.component.base_component'],
    });

    if (!template) throw new NotFoundException('Salary template not found.');
    return template;
  }

  async getAllTemplates(
    enterpriseId: string,
    organizationId: string,
  ): Promise<SalaryTemplate[]> {
    return this.templateRepository.find({
      where: { enterprise_id: enterpriseId, organization_id: organizationId },
      relations: ['components', 'components.component'],
    });
  }

  async updateTemplate(
    enterpriseId: string,
    organizationId: string,
    id: string,
    dto: CreateSalaryTemplateDto,
  ): Promise<SalaryTemplate> {
    const template = await this.templateRepository.findOne({
      where: { id },
      relations: ['components'],
    });
    if (!template) throw new NotFoundException('Salary template not found.');

    const requestedIds = dto.components.map((c) => c.component_id);

    const dbComponents = await this.componentRepository.find({
      where: { enterprise_id: enterpriseId, organization_id: organizationId },
      relations: ['base_component'],
    });

    const allDefaults = dbComponents.filter((c) =>
      DEFAULT_COMPONENT_NAMES.includes(c.name),
    );

    const defaultIdsToAdd = allDefaults
      .filter((d) => !requestedIds.includes(d.id))
      .map((d) => ({ component_id: d.id, sort_order: d.calculation_priority }));

    const finalComponentEntries = [...dto.components, ...defaultIdsToAdd];
    const finalIds = finalComponentEntries.map((c) => c.component_id);
    const selectedComponents = dbComponents.filter((c) => finalIds.includes(c.id));

    if (selectedComponents.length !== finalIds.length) {
      throw new BadRequestException('One or more component IDs are invalid.');
    }

    this.validateDependencyGraph(selectedComponents, finalComponentEntries);

    // Remove old join rows, then replace with new ones
    await this.templateComponentRepository.delete({ template_id: id });

    template.name = dto.name;
    template.description = dto.description ?? template.description;
    template.is_active = dto.is_active ?? template.is_active;
    template.components = finalComponentEntries.map((entry) => {
      const comp = selectedComponents.find((c) => c.id === entry.component_id)!;
      return this.templateComponentRepository.create({
        template_id: id,
        component_id: entry.component_id,
        override_config: (entry as any).override_config ?? null,
        sort_order: entry.sort_order ?? comp.calculation_priority,
        enterprise_id: enterpriseId,
        organization_id: organizationId,
      });
    });

    return this.templateRepository.save(template);
  }

  async deleteTemplate(id: string): Promise<void> {
    const template = await this.templateRepository.findOne({ where: { id } });
    if (!template) throw new NotFoundException('Salary template not found.');
    await this.templateRepository.remove(template);
  }

  private validateDependencyGraph(
    components: PayrollComponent[],
    entries: { component_id: string; sort_order?: number }[],
  ): void {
    const VIRTUAL_ROOTS = new Set(['CTC']);
    const compMap = new Map(components.map((c) => [c.id, c]));
    const sortMap = new Map(entries.map((e) => [e.component_id, e.sort_order ?? 0]));

    const resolved = new Set<string>();
    const visiting = new Set<string>();

    const visit = (id: string) => {
      if (resolved.has(id)) return;
      if (visiting.has(id)) {
        throw new BadRequestException(
          `Circular dependency detected for component ID ${id}.`,
        );
      }

      visiting.add(id);
      const comp = compMap.get(id);
      if (!comp) throw new BadRequestException(`Component context missing for ID ${id}.`);

      if (comp.calculate_from) {
        const base = compMap.get(comp.calculate_from);
        if (!base) {
          // Allow virtual roots like CTC by code
          const baseComp = components.find((c) => c.id === comp.calculate_from);
          if (!baseComp && !VIRTUAL_ROOTS.has(comp.calculate_from)) {
            throw new BadRequestException(
              `Dependency for '${comp.name}' is not included in the template.`,
            );
          }
        } else {
          const baseSort = sortMap.get(base.id) ?? base.calculation_priority;
          const thisSort = sortMap.get(id) ?? comp.calculation_priority;
          if (baseSort >= thisSort) {
            throw new BadRequestException(
              `'${base.name}' must have a lower sort_order than '${comp.name}'.`,
            );
          }
          visit(base.id);
        }
      }

      visiting.delete(id);
      resolved.add(id);
    };

    for (const id of compMap.keys()) visit(id);
  }
}
