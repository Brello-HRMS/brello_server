import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PayrollComponent } from '../entities/payroll-component.entity';
import { SalaryTemplateComponent } from '../entities/salary-template-component.entity';
import { PropagationApplyDto } from '../dto/employee-salary.dto';
import { EmployeeSalaryRepository } from '../repositories/employee-salary.repository';
import { PropagationScope, ComponentType } from '../enums/payroll.enum';

@Injectable()
export class ChangePropagationService {
  constructor(
    @InjectRepository(PayrollComponent)
    private readonly componentRepository: Repository<PayrollComponent>,
    @InjectRepository(SalaryTemplateComponent)
    private readonly templateComponentRepository: Repository<SalaryTemplateComponent>,
    private readonly employeeSalaryRepository: EmployeeSalaryRepository,
  ) {}

  async previewImpact(
    enterpriseId: string,
    organizationId: string,
    componentId: string,
  ): Promise<{ affected_templates: number; affected_employees: number }> {
    const component = await this.componentRepository.findOne({
      where: { id: componentId, enterprise_id: enterpriseId, organization_id: organizationId },
    });
    if (!component) throw new NotFoundException('Component not found.');

    const templateUsages = await this.templateComponentRepository.find({
      where: { component_id: componentId },
    });

    const activeEmployeeSalaryComponents =
      await this.employeeSalaryRepository.findComponentsByOrgForPropagation(
        enterpriseId,
        organizationId,
        component.name,
      );

    return {
      affected_templates: templateUsages.length,
      affected_employees: activeEmployeeSalaryComponents.length,
    };
  }

  async applyPropagation(
    enterpriseId: string,
    organizationId: string,
    dto: PropagationApplyDto,
  ): Promise<{ updated: number; skipped: number }> {
    const effectiveFrom = new Date(dto.effective_from);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (effectiveFrom < today) {
      throw new BadRequestException('effective_from cannot be in the past.');
    }

    if (dto.scope === PropagationScope.FUTURE_ONLY) {
      return { updated: 0, skipped: 0 };
    }

    const component = await this.componentRepository.findOne({
      where: { id: dto.component_id, enterprise_id: enterpriseId, organization_id: organizationId },
    });
    if (!component) throw new NotFoundException('Component not found.');

    const affectedSnapshots =
      await this.employeeSalaryRepository.findComponentsByOrgForPropagation(
        enterpriseId,
        organizationId,
        component.name,
      );

    const targetUserIds = dto.employee_ids?.length
      ? new Set(dto.employee_ids)
      : null;

    let updated = 0;
    let skipped = 0;

    for (const snap of affectedSnapshots) {
      const salary = (snap as any).employee_salary ?? snap['employee_salary'];
      const userId: string = salary?.user_id;
      if (!userId) { skipped++; continue; }

      if (targetUserIds && !targetUserIds.has(userId)) { skipped++; continue; }

      const existing = await this.employeeSalaryRepository.findSalaryWithComponents(
        salary.id,
      );
      if (!existing) { skipped++; continue; }

      const updatedComponents = (existing.components ?? []).map((c) => {
        if (c.component_name !== component.name) {
          return {
            component_name: c.component_name,
            component_type: c.component_type,
            value: Number(c.value),
            calculation_type: c.calculation_type,
            calculate_from: c.calculate_from,
            is_residual: c.is_residual,
            calculation_priority: c.calculation_priority,
          };
        }
        return {
          component_name: c.component_name,
          component_type: c.component_type,
          value: Number(component.value ?? 0),
          calculation_type: c.calculation_type,
          calculate_from: c.calculate_from,
          is_residual: c.is_residual,
          calculation_priority: c.calculation_priority,
        };
      });

      // Recalculate residual if present
      const totalEarnings = updatedComponents
        .filter((c) => c.component_type === ComponentType.EARNING && !c.is_residual)
        .reduce((sum, c) => sum + c.value, 0);
      for (const c of updatedComponents) {
        if (c.is_residual) {
          c.value = Math.max(0, Number(existing.ctc) - totalEarnings);
        }
      }

      await this.employeeSalaryRepository.createNewVersion({
        user_id: userId,
        ctc: Number(existing.ctc),
        effective_from: effectiveFrom,
        enterprise_id: enterpriseId,
        organization_id: organizationId,
        components: updatedComponents,
      });
      updated++;
    }

    return { updated, skipped };
  }
}
