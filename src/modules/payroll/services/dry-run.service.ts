import { Injectable, NotFoundException } from '@nestjs/common';
import { DryRunDto } from '../dto/dry-run.dto';
import { PayrollCalculationEngine } from './payroll-calculation.service';
import { SalaryTemplateEngine } from './salary-template.service';
import { SalaryStructureBuilder } from '../utils/salary-structure-builder.util';
import { ComponentType } from '../enums/payroll.enum';
import { SalaryComponentSnapshot } from '../repositories/employee-salary.repository';

@Injectable()
export class DryRunEngine {
  constructor(
    private readonly calculationEngine: PayrollCalculationEngine,
    private readonly templateEngine: SalaryTemplateEngine,
  ) {}

  async simulate(enterpriseId: string, organizationId: string, dto: DryRunDto) {
    const template = await this.templateEngine.getTemplateById(dto.template_id);
    if (!template) throw new NotFoundException('Template to simulate not found.');

    const snapshot = SalaryStructureBuilder.build(
      template,
      dto.ctc,
      dto.component_ids,
      dto.overrides,
    );

    const structure = this.snapshotToStructure(snapshot);

    const result = await this.calculationEngine.calculate(
      enterpriseId,
      organizationId,
      structure,
      {
        bonus: dto.bonus,
        loan_emi: dto.loan_emi,
        lwp_days: dto.lwp_days,
        total_working_days: 30,
      },
    );

    if (dto.other_deductions) {
      result.deductions_total += dto.other_deductions;
      result.net -= dto.other_deductions;
      result.deductions.push({
        name: 'Other Deductions',
        type: 'dynamic',
        value: dto.other_deductions,
        calculated_value: dto.other_deductions,
      });
    }

    return {
      ...result,
      metadata: {
        template_name: template.name,
        simulated_at: new Date(),
        currency: 'INR',
        sample_period: this.getSamplePeriod(),
      },
    };
  }

  private snapshotToStructure(snapshot: SalaryComponentSnapshot[]) {
    return {
      earnings: snapshot
        .filter((c) => c.component_type === ComponentType.EARNING)
        .map((c) => ({ name: c.component_name, type: c.component_type, value: c.value })),
      deductions: snapshot
        .filter((c) => c.component_type === ComponentType.DEDUCTION)
        .map((c) => ({ name: c.component_name, type: c.component_type, value: c.value })),
    };
  }

  private getSamplePeriod(): string {
    const now = new Date();
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];
    return `${months[now.getMonth()]} ${now.getFullYear()}`;
  }
}
