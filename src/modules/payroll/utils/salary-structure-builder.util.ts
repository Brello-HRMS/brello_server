import { CalculationType, ComponentType } from '../enums/payroll.enum';

/**
 * Shared utility to build a materialized salary structure from a template and CTC.
 * Ensures consistency between dry-run simulations and actual employee assignments.
 */
export class SalaryStructureBuilder {
  static build(template: any, ctc: number, overrides?: Record<string, any>) {
    // Sort components by sort_order
    const components = template.components.sort(
      (componentA, componentB) => componentA.sort_order - componentB.sort_order,
    );

    const earnings: any[] = [];
    const deductions: any[] = [];
    const calculationContext: Record<string, number> = {};

    for (const templateComponent of components) {
      const databaseComponent = templateComponent.component;
      const config = {
        ...databaseComponent.calculation_value,
        ...templateComponent.override_config,
      };

      // Apply overrides if any
      if (overrides && overrides[databaseComponent.name]) {
        Object.assign(config, overrides[databaseComponent.name]);
      }

      let value = 0;
      if (databaseComponent.calculation_type === CalculationType.FIXED) {
        value = config.value || 0;
      } else if (
        databaseComponent.calculation_type === CalculationType.PERCENTAGE
      ) {
        const base = config.base;
        const baseVal = calculationContext[base] || ctc; // Default to CTC if base not found
        value = (baseVal * (config.value || 0)) / 100;
      } else if (
        databaseComponent.calculation_type === CalculationType.RESIDUAL
      ) {
        const totalEarnings = earnings.reduce(
          (acc, earningItem) => acc + earningItem.value,
          0,
        );
        // Residual takes what's left of CTC after other earnings
        value = Math.max(0, ctc - totalEarnings);
      }

      calculationContext[databaseComponent.name] = value;

      const salaryStructureItem = {
        component_id: databaseComponent.id,
        name: databaseComponent.name,
        type: databaseComponent.type, // earning or deduction
        calculation_type: databaseComponent.calculation_type, // fixed, percentage, residual
        base: config.base,
        value: value,
      };

      if (databaseComponent.type === ComponentType.EARNING) {
        earnings.push(salaryStructureItem);
      } else {
        deductions.push(salaryStructureItem);
      }
    }

    return { earnings, deductions };
  }
}
