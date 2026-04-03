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

  private validateDependencies(
    dbComponents: PayrollComponent[],
    dtos: { component_id: string; override_config?: Record<string, any> }[],
  ) {
    const componentMap = new Map(
      dbComponents.map((dbComponent) => [dbComponent.id, dbComponent]),
    );
    const resolved = new Set<string>();
    const visiting = new Set<string>();

    const dfs = (id: string) => {
      if (resolved.has(id)) return;
      if (visiting.has(id))
        throw new BadRequestException(
          `Circular dependency detected for component ID ${id}`,
        );

      visiting.add(id);
      const dbComp = componentMap.get(id);
      const dtoComp = dtos.find(
        (dtoComponent) => dtoComponent.component_id === id,
      );

      // Merge config to check dependencies
      const config = {
        ...dbComp?.calculation_value,
        ...dtoComp?.override_config,
      };

      if (config && config.base) {
        // Base can be a single string or an array of strings depending on complex formulas
        const dependencies = Array.isArray(config.base)
          ? config.base
          : [config.base];

        for (const depName of dependencies) {
          const depComp = dbComponents.find(
            (dbComponent) => dbComponent.name === depName,
          );
          if (!depComp) {
            throw new BadRequestException(
              `Dependency '${depName}' for component ID ${id} is missing in the template.`,
            );
          }
          dfs(depComp.id);
        }
      }

      visiting.delete(id);
      resolved.add(id);
    };

    for (const id of componentMap.keys()) {
      dfs(id);
    }
  }
}
