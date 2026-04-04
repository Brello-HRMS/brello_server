import { Injectable, NotFoundException } from '@nestjs/common';
import { DryRunDto } from '../dto/dry-run.dto';
import { PayrollCalculationEngine } from './payroll-calculation.service';
import { SalaryTemplateEngine } from './salary-template.service';
import { SalaryStructureBuilder } from '../utils/salary-structure-builder.util';

@Injectable()
export class DryRunEngine {
  constructor(
    private readonly calculationEngine: PayrollCalculationEngine,
    private readonly templateEngine: SalaryTemplateEngine,
  ) {}

  async simulate(enterpriseId: string, organizationId: string, dto: DryRunDto) {
    const template = await this.templateEngine.getTemplateById(dto.template_id);
    if (!template) {
      throw new NotFoundException('Template to simulate not found');
    }

    // Use shared utility to materialize the salary structure from template and CTC
    const structure = SalaryStructureBuilder.build(
      template,
      dto.ctc,
      dto.overrides,
    );

    // Run the calculation engine with dynamic inputs (bonus, LWP, etc.)
    const calculationResult = await this.calculationEngine.calculate(
      enterpriseId,
      organizationId,
      structure,
      {
        bonus: dto.bonus,
        loan_emi: dto.loan_emi,
        lwp_days: dto.lwp_days,
        total_working_days: 30, // Default assumption for simulation
      },
    );

    // If other_deductions are provided, subtract them from net
    if (dto.other_deductions) {
      calculationResult.deductions_total += dto.other_deductions;
      calculationResult.net -= dto.other_deductions;
      calculationResult.deductions.push({
        name: 'Other Deductions',
        type: 'dynamic',
        value: dto.other_deductions,
        calculated_value: dto.other_deductions,
      });
    }

    // Enhance response with metadata for the preview modal and runtime payslip
    return {
      ...calculationResult,
      metadata: {
        template_name: template.name,
        simulated_at: new Date(),
        currency: 'INR', // Assuming default for now
        sample_period: this.getSamplePeriod(),
      },
    };
  }

  private getSamplePeriod(): string {
    const now = new Date();
    const months = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];
    return `${months[now.getMonth()]} ${now.getFullYear()}`;
  }
}
