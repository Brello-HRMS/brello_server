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
    /**
     * Optional per-employee statutory overrides (from EmployeeStatutoryOverride).
     * `pf_applicable=false` excludes the employee from PF (e.g. an above-ceiling
     * new joiner with no prior PF account). `pf_override_salary`, when set,
     * replaces the Basic component as the PF wage base.
     */
    employee?: {
      pf_applicable?: boolean;
      pf_override_salary?: number | null;
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

    // ── Statutory: Provident Fund (EPF) ──────────────────────────────────────
    // Government rule (EPFO): PF is computed on "PF wages" (Basic + DA) and the
    // statutory wage ceiling is ₹15,000/month. By default contributions are
    // restricted to that ceiling — PF base = min(basic, ceiling) — which is the
    // compliant minimum and the default in Zoho Payroll / greytHR / Keka. An
    // employer may instead contribute on the full basic ("PF on actual"), exposed
    // via PfConfig.restrict_to_ceiling = false (mirrors those platforms' toggle).
    //
    // NOTE: `minimum_salary_threshold` holds the EPF wage *ceiling* (15,000), not
    // a floor. (Column name kept for compatibility — renaming it to
    // `pf_wage_ceiling` is a recommended follow-up.)
    const warnings: string[] = [];
    let employerContribution = 0;

    const pfConfig = await this.pfConfigService.getConfig(
      enterpriseId,
      organizationId,
    );

    if (!pfConfig || !pfConfig.is_enabled) {
      return {
        gross,
        deductions_total: totalDeductions,
        net: gross - totalDeductions,
        employer_contribution: employerContribution,
        earnings: calculatedEarnings,
        deductions: calculatedDeductions,
        warnings: [
          pfConfig
            ? 'PF is disabled for this organization. Skipping PF calculation.'
            : 'PF configuration missing. Skipping PF calculation.',
        ],
      };
    }

    // Per-employee statutory exclusion (e.g. above-ceiling new joiner, no prior
    // PF account) takes precedence over the org-level config.
    if (employee?.pf_applicable === false) {
      warnings.push('PF not applicable for this employee (statutory override).');
      return {
        gross,
        deductions_total: totalDeductions,
        net: gross - totalDeductions,
        employer_contribution: employerContribution,
        earnings: calculatedEarnings,
        deductions: calculatedDeductions,
        warnings,
      };
    }

    const basicComp = calculatedEarnings.find(
      (earningComponent) =>
        earningComponent.name.toLowerCase() === 'basic' ||
        earningComponent.name.toLowerCase() === 'basic salary',
    );

    // PF wage base: an explicit per-employee override wins; otherwise the Basic
    // component. PF is mandatory for every enrolled employee at/below the ceiling.
    const overrideBasis =
      employee?.pf_override_salary != null
        ? Number(employee.pf_override_salary)
        : undefined;
    const basicForPf = overrideBasis ?? basicComp?.calculated_value;

    if (basicForPf != null) {
      const ceiling = Number(pfConfig.minimum_salary_threshold);
      const restrictToCeiling = pfConfig.restrict_to_ceiling ?? true;
      const pfBase =
        restrictToCeiling && ceiling > 0
          ? Math.min(basicForPf, ceiling)
          : basicForPf;

      const employeePf = (pfBase * Number(pfConfig.employee_contribution)) / 100;
      const employerPf = (pfBase * Number(pfConfig.employer_contribution)) / 100;

      calculatedDeductions.push({
        name: 'PF',
        type: 'statutory',
        value: employeePf,
        calculated_value: employeePf,
      });
      totalDeductions += employeePf;
      employerContribution = employerPf;
    } else {
      warnings.push(
        'No "Basic" component found in the salary structure. Skipping PF calculation.',
      );
    }

    const net = gross - totalDeductions;

    return {
      gross,
      deductions_total: totalDeductions,
      net,
      employer_contribution: employerContribution,
      earnings: calculatedEarnings,
      deductions: calculatedDeductions,
      warnings,
    };
  }
}
