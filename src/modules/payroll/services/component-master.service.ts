import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PayrollComponent } from '../entities/payroll-component.entity';
import { CreatePayrollComponentDto } from '../dto/payroll-component.dto';
import { ComponentType, CalculationType } from '../enums/payroll.enum';

@Injectable()
export class ComponentMasterService {
  constructor(
    @InjectRepository(PayrollComponent)
    private readonly componentRepository: Repository<PayrollComponent>,
  ) {}

  async createComponent(
    enterpriseId: string,
    organizationId: string,
    dto: CreatePayrollComponentDto,
  ): Promise<PayrollComponent> {
    // Basic component is usually system-defined, user cannot define another 'Basic Salary' that is system defined
    if (dto.is_system_defined) {
      throw new BadRequestException(
        'Cannot create system-defined components manually.',
      );
    }

    const component = this.componentRepository.create({
      ...dto,
      enterprise_id: enterpriseId,
      organization_id: organizationId,
    });

    return this.componentRepository.save(component);
  }

  async updateComponent(
    id: string,
    dto: Partial<CreatePayrollComponentDto>,
  ): Promise<PayrollComponent> {
    const component = await this.componentRepository.findOne({ where: { id } });

    if (!component) {
      throw new NotFoundException(`Component with ID ${id} not found.`);
    }

    if (component.is_system_defined) {
      throw new BadRequestException(
        'System-defined components cannot be modified.',
      );
    }

    const updated = this.componentRepository.merge(component, dto as any);
    return this.componentRepository.save(updated);
  }

  async deleteComponent(id: string): Promise<void> {
    const component = await this.componentRepository.findOne({ where: { id } });

    if (!component) {
      throw new NotFoundException(`Component with ID ${id} not found.`);
    }

    if (component.is_system_defined) {
      throw new BadRequestException(
        'System-defined components cannot be deleted.',
      );
    }

    // Dependency check: Find components that use this component as a base
    const dependents = await this.componentRepository.find({
      where: {
        enterprise_id: component.enterprise_id,
        organization_id: component.organization_id,
      },
    });

    const dependentNames = dependents
      .filter((d) => d.calculation_value?.base === component.name)
      .map((d) => d.name);

    if (dependentNames.length > 0) {
      throw new BadRequestException(
        `Component cannot be deleted because the following components are dependent on it: ${dependentNames.join(', ')}`,
      );
    }

    await this.componentRepository.remove(component);
  }

  async ensureDefaultComponents(
    enterpriseId: string,
    organizationId: string,
  ): Promise<void> {
    const basicComponent = await this.componentRepository.findOne({
      where: {
        enterprise_id: enterpriseId,
        organization_id: organizationId,
        is_system_defined: true,
        name: 'Basic Salary',
      },
    });

    if (!basicComponent) {
      const defaultBasic = this.componentRepository.create({
        name: 'Basic Salary',
        type: ComponentType.EARNING,
        calculation_type: CalculationType.PERCENTAGE,
        calculation_value: { value: 50, base: 'CTC' },
        is_taxable: true,
        is_system_defined: true,
        is_active: true,
        enterprise_id: enterpriseId,
        organization_id: organizationId,
      });
      await this.componentRepository.save(defaultBasic);
    }
  }

  async getAllComponents(
    enterpriseId: string,
    organizationId: string,
  ): Promise<PayrollComponent[]> {
    await this.ensureDefaultComponents(enterpriseId, organizationId);
    return this.componentRepository.find({
      where: { enterprise_id: enterpriseId, organization_id: organizationId },
    });
  }
}
