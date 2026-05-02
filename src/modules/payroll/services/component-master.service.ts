import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PayrollComponent } from '../entities/payroll-component.entity';
import { SalaryTemplateComponent } from '../entities/salary-template-component.entity';
import {
  CreatePayrollComponentDto,
  UpdatePayrollComponentDto,
} from '../dto/payroll-component.dto';
import {
  ComponentType,
  ComponentCategory,
  CalculationType,
} from '../enums/payroll.enum';

@Injectable()
export class ComponentMasterService {
  constructor(
    @InjectRepository(PayrollComponent)
    private readonly componentRepository: Repository<PayrollComponent>,
    @InjectRepository(SalaryTemplateComponent)
    private readonly templateComponentRepository: Repository<SalaryTemplateComponent>,
  ) {}

  async createComponent(
    enterpriseId: string,
    organizationId: string,
    dto: CreatePayrollComponentDto,
  ): Promise<PayrollComponent> {
    if (dto.is_residual) {
      await this.assertSingleResidual(enterpriseId, organizationId);
    }

    if (dto.calculation_type === CalculationType.RESIDUAL) {
      await this.assertSingleResidual(enterpriseId, organizationId);
    }

    const component = this.componentRepository.create({
      ...dto,
      is_residual: dto.is_residual ?? dto.calculation_type === CalculationType.RESIDUAL,
      is_default: false,
      enterprise_id: enterpriseId,
      organization_id: organizationId,
    });

    return this.componentRepository.save(component);
  }

  async updateComponent(
    id: string,
    dto: UpdatePayrollComponentDto,
  ): Promise<PayrollComponent> {
    const component = await this.componentRepository.findOne({ where: { id } });

    if (!component) {
      throw new NotFoundException(`Component with ID ${id} not found.`);
    }

    if (component.is_default) {
      const updated = this.componentRepository.merge(component, {
        value: dto.value ?? component.value,
        calculation_priority: dto.calculation_priority ?? component.calculation_priority,
      });
      return this.componentRepository.save(updated);
    }

    const updated = this.componentRepository.merge(component, dto as any);
    return this.componentRepository.save(updated);
  }

  async deleteComponent(id: string): Promise<void> {
    const component = await this.componentRepository.findOne({ where: { id } });

    if (!component) {
      throw new NotFoundException(`Component with ID ${id} not found.`);
    }

    if (component.is_default) {
      throw new BadRequestException('Default components cannot be deleted.');
    }

    const usedInTemplate = await this.templateComponentRepository.findOne({
      where: { component_id: id },
    });

    if (usedInTemplate) {
      throw new BadRequestException(
        'Component cannot be deleted because it is used in one or more salary templates.',
      );
    }

    await this.componentRepository.remove(component);
  }

  async getAllComponents(
    enterpriseId: string,
    organizationId: string,
  ): Promise<PayrollComponent[]> {
    await this.ensureDefaultComponents(enterpriseId, organizationId);
    return this.componentRepository.find({
      where: {
        enterprise_id: enterpriseId,
        organization_id: organizationId,
        is_active: true,
      },
      order: { calculation_priority: 'ASC' },
    });
  }

  async ensureDefaultComponents(
    enterpriseId: string,
    organizationId: string,
  ): Promise<void> {
    const existing = await this.componentRepository.find({
      where: {
        enterprise_id: enterpriseId,
        organization_id: organizationId,
        is_default: true,
      },
    });

    const existingNames = new Set(existing.map((c) => c.name));

    // 1. CTC (virtual root — code='CTC', priority=0)
    let ctcId: string | undefined = existing.find((c) => c.code === 'CTC')?.id;
    if (!ctcId) {
      const ctc = await this.componentRepository.save(
        this.componentRepository.create({
          name: 'CTC',
          code: 'CTC',
          component_type: ComponentType.EARNING,
          category: ComponentCategory.FIXED,
          calculation_type: CalculationType.FIXED,
          value: 0,
          is_default: true,
          is_editable: false,
          is_taxable: false,
          calculation_priority: 0,
          enterprise_id: enterpriseId,
          organization_id: organizationId,
        }),
      );
      ctcId = ctc.id;
    }

    // 2. Basic Salary (50% of CTC, priority=1)
    let basicId: string | undefined = existing.find((c) => c.name === 'Basic Salary')?.id;
    if (!basicId) {
      const basic = await this.componentRepository.save(
        this.componentRepository.create({
          name: 'Basic Salary',
          component_type: ComponentType.EARNING,
          category: ComponentCategory.FIXED,
          calculation_type: CalculationType.PERCENTAGE,
          calculate_from: ctcId,
          value: 50,
          is_default: true,
          is_editable: true,
          is_taxable: true,
          calculation_priority: 1,
          enterprise_id: enterpriseId,
          organization_id: organizationId,
        }),
      );
      basicId = basic.id;
    }

    // 3. PF Employee (12% of Basic, priority=2)
    if (!existingNames.has('PF Employee')) {
      await this.componentRepository.save(
        this.componentRepository.create({
          name: 'PF Employee',
          component_type: ComponentType.DEDUCTION,
          category: ComponentCategory.STATUTORY,
          calculation_type: CalculationType.PERCENTAGE,
          calculate_from: basicId,
          value: 12,
          is_default: true,
          is_editable: false,
          is_taxable: false,
          calculation_priority: 2,
          enterprise_id: enterpriseId,
          organization_id: organizationId,
        }),
      );
    }

    // 4. PF Employer (12% of Basic, priority=3)
    if (!existingNames.has('PF Employer')) {
      await this.componentRepository.save(
        this.componentRepository.create({
          name: 'PF Employer',
          component_type: ComponentType.DEDUCTION,
          category: ComponentCategory.STATUTORY,
          calculation_type: CalculationType.PERCENTAGE,
          calculate_from: basicId,
          value: 12,
          is_default: true,
          is_editable: false,
          is_taxable: false,
          calculation_priority: 3,
          enterprise_id: enterpriseId,
          organization_id: organizationId,
        }),
      );
    }

    // 5. Special Allowance (residual earning, priority=99)
    if (!existingNames.has('Special Allowance')) {
      await this.componentRepository.save(
        this.componentRepository.create({
          name: 'Special Allowance',
          component_type: ComponentType.EARNING,
          category: ComponentCategory.FIXED,
          calculation_type: CalculationType.RESIDUAL,
          is_residual: true,
          is_default: true,
          is_editable: false,
          is_taxable: true,
          calculation_priority: 99,
          enterprise_id: enterpriseId,
          organization_id: organizationId,
        }),
      );
    }
  }

  private async assertSingleResidual(
    enterpriseId: string,
    organizationId: string,
  ): Promise<void> {
    const existing = await this.componentRepository.findOne({
      where: {
        enterprise_id: enterpriseId,
        organization_id: organizationId,
        is_residual: true,
      },
    });
    if (existing) {
      throw new BadRequestException(
        'Only one residual component is allowed per organization.',
      );
    }
  }
}
