import { Injectable } from '@nestjs/common';
import { PfConfigService } from './pf-config.service';

@Injectable()
export class PayrollCalculationEngine {
  constructor(private readonly pfConfigService: PfConfigService) {}

  async calculate(
    enterpriseId: string,
    organizationId: string,
    salaryStructure: { earnings: any[]; deductions: any[] },
    dynamicInputs: {
      bonus?: number;
      loan_emi?: number;
      lwp_days?: number;
      total_working_days?: number;
    },
  ) {
    const { earnings, deductions } = salaryStructure;
    let gross = 0;

    // LWP Calculation factor
    let lwpFactor = 1;
    if (dynamicInputs.lwp_days && dynamicInputs.total_working_days) {
      lwpFactor =
        (dynamicInputs.total_working_days - dynamicInputs.lwp_days) /
        dynamicInputs.total_working_days;
    }

    const calculatedEarnings = earnings.map((earningItem) => {
      const calculatedValue = earningItem.value * lwpFactor;
      gross += calculatedValue;
      return { ...earningItem, calculated_value: calculatedValue };
    });

    if (dynamicInputs.bonus) {
      gross += dynamicInputs.bonus;
      calculatedEarnings.push({
        name: 'Bonus',
        type: 'dynamic',
        value: dynamicInputs.bonus,
        calculated_value: dynamicInputs.bonus,
      });
    }

    // Process Static Deductions
    let totalDeductions = 0;
    const calculatedDeductions = deductions.map((deductionItem) => {
      totalDeductions += deductionItem.value;
      return { ...deductionItem, calculated_value: deductionItem.value };
    });

    if (dynamicInputs.loan_emi) {
      totalDeductions += dynamicInputs.loan_emi;
      calculatedDeductions.push({
        name: 'Loan EMI',
        type: 'dynamic',
        value: dynamicInputs.loan_emi,
        calculated_value: dynamicInputs.loan_emi,
      });
    }

    // Process Statutory (PF)
    let employerContribution = 0;
    const pfConfig = await this.pfConfigService.getConfig(
      enterpriseId,
      organizationId,
    );

    if (!pfConfig) {
      return {
        gross,
        deductions_total: totalDeductions,
        net: gross - totalDeductions,
        employer_contribution: employerContribution,
        earnings: calculatedEarnings,
        deductions: calculatedDeductions,
        warnings: ['PF configuration missing. Skipping PF calculation.'],
      };
    }

    const basicComp = calculatedEarnings.find(
      (earningComponent) =>
        earningComponent.name.toLowerCase() === 'basic' ||
        earningComponent.name.toLowerCase() === 'basic salary',
    );

    if (
      basicComp &&
      basicComp.calculated_value >= pfConfig.minimum_salary_threshold
    ) {
      const applicableSalary = basicComp.calculated_value;

      const employeePf =
        (applicableSalary * pfConfig.employee_contribution) / 100;
      const employerPf =
        (applicableSalary * pfConfig.employer_contribution) / 100;

      calculatedDeductions.push({
        name: 'PF',
        type: 'statutory',
        value: employeePf,
        calculated_value: employeePf,
      });
      totalDeductions += employeePf;
      employerContribution = employerPf;
    }

    const net = gross - totalDeductions;

    return {
      gross,
      deductions_total: totalDeductions,
      net,
      employer_contribution: employerContribution,
      earnings: calculatedEarnings,
      deductions: calculatedDeductions,
      warnings: [],
    };
  }
}
