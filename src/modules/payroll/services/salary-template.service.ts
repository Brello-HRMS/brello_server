import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { SalaryTemplate } from '../entities/salary-template.entity';
import { SalaryTemplateComponent } from '../entities/salary-template-component.entity';
import { PayrollComponent } from '../entities/payroll-component.entity';
import { CreateSalaryTemplateDto } from '../dto/salary-template.dto';

@Injectable()
export class SalaryTemplateEngine {
  constructor(
    @InjectRepository(SalaryTemplate)
    private readonly templateRepository: Repository<SalaryTemplate>,
    @InjectRepository(PayrollComponent)
    private readonly componentRepository: Repository<PayrollComponent>,
  ) {}

  async createTemplate(
    enterpriseId: string,
    organizationId: string,
    dto: CreateSalaryTemplateDto,
  ): Promise<SalaryTemplate> {
    const componentIds = dto.components.map(
      (componentDto) => componentDto.component_id,
    );
    const dbComponents = await this.componentRepository.findBy({
      id: In(componentIds),
    });

    if (dbComponents.length !== componentIds.length) {
      throw new BadRequestException('One or more components are invalid.');
    }

    // Verify Basic Salary is included
    const hasBasic = dbComponents.some(
      (databaseComponent) =>
        databaseComponent.name.toLowerCase() === 'basic' ||
        databaseComponent.name.toLowerCase() === 'basic salary',
    );
    if (!hasBasic) {
      throw new BadRequestException(
        'Template must include Basic Salary component.',
      );
    }

    // Validate DAG for dependencies
    this.validateDependencies(dbComponents, dto.components);

    const template = this.templateRepository.create({
      name: dto.name,
      description: dto.description,
      is_active: dto.is_active ?? true,
      enterprise_id: enterpriseId,
      organization_id: organizationId,
      components: dto.components.map((componentDto) => ({
        component_id: componentDto.component_id,
        override_config: componentDto.override_config,
        sort_order: componentDto.sort_order,
        enterprise_id: enterpriseId,
        organization_id: organizationId,
      })),
    });

    return this.templateRepository.save(template);
  }

  async getTemplateById(id: string): Promise<SalaryTemplate> {
    const template = await this.templateRepository.findOne({
      where: { id },
      relations: ['components', 'components.component'],
    });

    if (!template) {
      throw new NotFoundException('Salary template not found.');
    }

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

  private validateDependencies(
    databaseComponents: PayrollComponent[],
    componentDtos: {
      component_id: string;
      override_config?: Record<string, any>;
      sort_order: number;
    }[],
  ) {
    const VIRTUAL_BASES = ['CTC'];
    const componentMap = new Map(
      databaseComponents.map((component) => [component.id, component]),
    );

    const componentDtoMap = new Map(
      componentDtos.map((dto) => [dto.component_id, dto]),
    );

    const resolvedComponents = new Set<string>();
    const visitingComponents = new Set<string>();

    const validateComponentDependencies = (componentId: string) => {
      if (resolvedComponents.has(componentId)) return;
      if (visitingComponents.has(componentId)) {
        throw new BadRequestException(
          `Circular dependency detected for component ID ${componentId}`,
        );
      }

      visitingComponents.add(componentId);

      const databaseComponent = componentMap.get(componentId);
      const dtoComponent = componentDtoMap.get(componentId);

      if (!databaseComponent || !dtoComponent) {
        throw new BadRequestException(
          `Component context missing for ID ${componentId}`,
        );
      }

      // Merge configuration to check dependencies
      const configuration = {
        ...(databaseComponent.calculation_value as Record<string, any>),
        ...(dtoComponent.override_config as Record<string, any>),
      };

      if (configuration && configuration.base) {
        const dependencies = Array.isArray(configuration.base)
          ? configuration.base
          : [configuration.base];

        for (const dependencyName of dependencies) {
          // 1. Allow built-in virtual bases
          if (VIRTUAL_BASES.includes(dependencyName.toUpperCase())) {
            continue;
          }

          // 2. Find dependency in the template's components
          const dependencyComponent = databaseComponents.find(
            (component) => component.name === dependencyName,
          );

          if (!dependencyComponent) {
            throw new BadRequestException(
              `Dependency '${dependencyName}' for component '${databaseComponent.name}' is missing in the template. Every component in a formula must be included in the template.`,
            );
          }

          // 3. Strict Sort Order Check: Dependency must be calculated BEFORE dependent
          const dependencyDto = componentDtoMap.get(dependencyComponent.id);
          if (
            dependencyDto &&
            dependencyDto.sort_order >= dtoComponent.sort_order
          ) {
            throw new BadRequestException(
              `Calculation sequence error: '${dependencyComponent.name}' must have a lower sort_order than '${databaseComponent.name}' because '${databaseComponent.name}' depends on it.`,
            );
          }

          validateComponentDependencies(dependencyComponent.id);
        }
      }

      visitingComponents.delete(componentId);
      resolvedComponents.add(componentId);
    };

    for (const componentId of componentMap.keys()) {
      validateComponentDependencies(componentId);
    }
  }
}
