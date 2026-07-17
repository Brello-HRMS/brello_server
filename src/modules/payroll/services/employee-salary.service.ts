import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EmployeeSalary } from '../entities/employee-salary.entity';
import { EmployeeSalaryComponent } from '../entities/employee-salary-component.entity';
import {
  AssignEmployeeSalaryDto,
  BulkAssignEmployeeSalaryDto,
  UpdateEmployeeSalaryDto,
} from '../dto/employee-salary.dto';
import { EmployeeQueryDto } from '../dto/employee-listing.dto';
import { SalaryTemplateEngine } from './salary-template.service';
import { SalaryStructureBuilder } from '../utils/salary-structure-builder.util';
import {
  EmployeeSalaryRepository,
  SalaryComponentSnapshot,
} from '../repositories/employee-salary.repository';
import { ComponentType } from '../enums/payroll.enum';
import { AuditContextService } from '../../audit/services/audit-context.service';

export interface AssignAdHocSalaryParams {
  user_id: string;
  ctc: number;
  effective_from: Date;
  components: SalaryComponentSnapshot[];
}

@Injectable()
export class EmployeeSalaryEngine {
  constructor(
    private readonly employeeSalaryRepository: EmployeeSalaryRepository,
    private readonly templateEngine: SalaryTemplateEngine,
    private readonly auditContext: AuditContextService,
  ) {}

  async assignSalary(
    enterpriseId: string,
    organizationId: string,
    dto: AssignEmployeeSalaryDto,
  ): Promise<EmployeeSalary> {
    const template = await this.templateEngine.getTemplateById(dto.template_id);
    const effectiveFrom = new Date(dto.effective_from);
    const snapshot = SalaryStructureBuilder.build(
      template,
      dto.ctc,
      dto.component_ids,
      dto.overrides,
    );

    return this.employeeSalaryRepository.createNewVersion({
      user_id: dto.user_id,
      ctc: dto.ctc,
      effective_from: effectiveFrom,
      enterprise_id: enterpriseId,
      organization_id: organizationId,
      components: snapshot,
    });
  }

  /**
   * Assigns a salary built from an explicit component list rather than a SalaryTemplate —
   * for callers (e.g. offer-management sync) that have a component snapshot but no template_id.
   * Keeps EmployeeSalaryRepository access internal to the payroll module.
   */
  async assignAdHocSalary(
    enterpriseId: string,
    organizationId: string,
    params: AssignAdHocSalaryParams,
  ): Promise<EmployeeSalary> {
    return this.employeeSalaryRepository.createNewVersion({
      user_id: params.user_id,
      ctc: params.ctc,
      effective_from: params.effective_from,
      enterprise_id: enterpriseId,
      organization_id: organizationId,
      components: params.components,
    });
  }

  async bulkAssignSalary(
    enterpriseId: string,
    organizationId: string,
    dto: BulkAssignEmployeeSalaryDto,
  ): Promise<{ assigned: number; failed: string[] }> {
    const template = await this.templateEngine.getTemplateById(dto.template_id);
    const effectiveFrom = new Date(dto.effective_from);
    const snapshot = SalaryStructureBuilder.build(template, dto.ctc);

    let assigned = 0;
    const failed: string[] = [];

    for (const userId of dto.user_ids) {
      try {
        await this.employeeSalaryRepository.createNewVersion({
          user_id: userId,
          ctc: dto.ctc,
          effective_from: effectiveFrom,
          enterprise_id: enterpriseId,
          organization_id: organizationId,
          components: snapshot,
        });
        assigned++;
      } catch {
        failed.push(userId);
      }
    }

    return { assigned, failed };
  }

  async getEmployeeSalary(userId: string): Promise<EmployeeSalary> {
    const salary = await this.employeeSalaryRepository.findActiveSalary(userId);
    if (!salary) throw new NotFoundException('Employee salary structure not found.');
    return salary;
  }

  async getEmployeeSalaryHistory(userId: string): Promise<EmployeeSalary[]> {
    return this.employeeSalaryRepository.findSalaryHistory(userId);
  }

  async getEmployeesList(
    enterpriseId: string,
    orgId: string,
    query: EmployeeQueryDto,
  ) {
    const [users, total] = await this.employeeSalaryRepository.queryEmployeesList(
      enterpriseId,
      orgId,
      query,
    );

    const data = await Promise.all(
      users.map(async (u: any) => {
        const base = {
          id: u.id,
          name: u.fullName,
          employee_code: u.user_profile?.employee_id || null,
          department: u.department?.name || null,
        };

        const salary = await this.employeeSalaryRepository.findActiveSalary(u.id);
        if (!salary) {
          return {
            ...base,
            annual_ctc: null,
            monthly_ctc: null,
            gross: null,
            deductions: null,
            take_home: null,
          };
        }

        const withComponents =
          await this.employeeSalaryRepository.findSalaryWithComponents(salary.id);

        const components = withComponents?.components ?? [];
        const monthlyEarnings = components
          .filter((c) => c.component_type === ComponentType.EARNING)
          .reduce((s, c) => s + Number(c.value), 0);
        const monthlyDeductions = components
          .filter((c) => c.component_type === ComponentType.DEDUCTION)
          .reduce((s, c) => s + Number(c.value), 0);

        return {
          ...base,
          annual_ctc: Number(salary.ctc),
          monthly_ctc: Math.round(Number(salary.ctc) / 12),
          gross: Math.round(monthlyEarnings),
          deductions: Math.round(monthlyDeductions),
          take_home: Math.round(monthlyEarnings - monthlyDeductions),
        };
      }),
    );

    return { data, total, page: query.page || 1, limit: query.limit || 10 };
  }

  async getEmployeeSalaryStructure(userId: string) {
    const user = await this.employeeSalaryRepository.findUserWithProfile(userId);
    if (!user) throw new NotFoundException('Employee not found.');

    const salary = await this.employeeSalaryRepository.findActiveSalary(userId);

    if (!salary) {
      return {
        employee: {
          name: user.fullName,
          employee_code: user.user_profile?.employee_id || null,
          department: (user as any).department?.name || null,
        },
        ctc: 0,
        version: null,
        components: [],
      };
    }

    const salaryWithComponents =
      await this.employeeSalaryRepository.findSalaryWithComponents(salary.id);

    if (!salaryWithComponents) throw new NotFoundException('Salary record not found.');

    return {
      employee: {
        name: user.fullName,
        employee_code: user.user_profile?.employee_id || null,
        department: (user as any).department?.name || null,
      },
      ctc: salaryWithComponents.ctc,
      version: salaryWithComponents.version_number,
      effective_from: salaryWithComponents.effective_from,
      components: (salaryWithComponents.components ?? []).map(
        (c: EmployeeSalaryComponent) => ({
          component_name: c.component_name,
          component_type: c.component_type,
          value: c.value,
          calculation_type: c.calculation_type,
          is_residual: c.is_residual,
          calculation_priority: c.calculation_priority,
        }),
      ),
    };
  }

  async updateEmployeeSalaryStructure(
    enterpriseId: string,
    organizationId: string,
    userId: string,
    dto: UpdateEmployeeSalaryDto,
  ) {
    const salary = await this.employeeSalaryRepository.findActiveSalary(userId);
    if (!salary) throw new NotFoundException('Employee salary structure not found.');

    const existing =
      await this.employeeSalaryRepository.findSalaryWithComponents(salary.id);
    if (!existing) throw new NotFoundException('Salary record not found.');

    this.auditContext.setPreValue(existing as unknown as Record<string, unknown>);

    const updatesMap = new Map(
      dto.components.map((u) => [u.component_name, u.value]),
    );

    const updatedComponents = (existing.components ?? []).map(
      (c: EmployeeSalaryComponent) => ({
        component_name: c.component_name,
        component_type: c.component_type,
        calculation_type: c.calculation_type,
        calculate_from: c.calculate_from,
        is_residual: c.is_residual,
        calculation_priority: c.calculation_priority,
        value: updatesMap.has(c.component_name)
          ? updatesMap.get(c.component_name)!
          : Number(c.value),
      }),
    );

    // Recalculate residual
    const totalEarnings = updatedComponents
      .filter(
        (c) => c.component_type === ComponentType.EARNING && !c.is_residual,
      )
      .reduce((sum: number, c) => sum + c.value, 0);

    for (const c of updatedComponents) {
      if (c.is_residual) {
        c.value = Math.max(0, Number(existing.ctc) - totalEarnings);
      }
    }

    await this.employeeSalaryRepository.createNewVersion({
      user_id: userId,
      ctc: Number(existing.ctc),
      effective_from: new Date(dto.effective_from),
      enterprise_id: enterpriseId,
      organization_id: organizationId,
      components: updatedComponents,
    });

    return { message: 'Salary updated successfully.' };
  }
}
