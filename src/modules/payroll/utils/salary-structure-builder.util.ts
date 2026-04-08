import { CalculationType, ComponentType } from '../enums/payroll.enum';

/**
 * Shared utility to build a materialized salary structure from a template and CTC.
 * Ensures consistency between dry-run simulations and actual employee assignments.
 */
export class SalaryStructureBuilder {
  static build(
    template: any,
    costToCompany: number,
    overrides?: Record<string, any>,
  ) {
    // Sort components by sort_order
    const components = template.components.sort(
      (componentA, componentB) => componentA.sort_order - componentB.sort_order,
    );

    const earnings: any[] = [];
    const deductions: any[] = [];
    const calculationContext: Record<string, number> = {};

    for (const templateComponentItem of components) {
      const databaseComponent = templateComponentItem.component;
      const configuration = {
        ...databaseComponent.calculation_value,
        ...templateComponentItem.override_config,
      };

      // Apply overrides if any
      if (overrides && overrides[databaseComponent.name]) {
        Object.assign(configuration, overrides[databaseComponent.name]);
      }

      let value = 0;
      if (databaseComponent.calculation_type === CalculationType.FIXED) {
        value = configuration.value || 0;
      } else if (
        databaseComponent.calculation_type === CalculationType.PERCENTAGE
      ) {
        const base = configuration.base;
        let baseValue = 0;

        if (base === 'CTC') {
          baseValue = costToCompany;
        } else if (calculationContext[base] !== undefined) {
          baseValue = calculationContext[base];
        } else {
          throw new Error(
            `Calculation Error: Dependency '${base}' for component '${databaseComponent.name}' was not found in the current sequence. Ensure the base component is added to the template and has a lower sort order.`,
          );
        }

        value = (baseValue * (configuration.value || 0)) / 100;
      } else if (
        databaseComponent.calculation_type === CalculationType.RESIDUAL
      ) {
        const totalEarnings = earnings.reduce(
          (total, earningItem) => total + earningItem.value,
          0,
        );
        // Residual takes what's left of CTC after other earnings
        value = Math.max(0, costToCompany - totalEarnings);
      }

      calculationContext[databaseComponent.name] = value;

      const salaryStructureItem = {
        component_id: databaseComponent.id,
        name: databaseComponent.name,
        type: databaseComponent.type, // earning or deduction
        calculation_type: databaseComponent.calculation_type, // fixed, percentage, residual
        base: configuration.base,
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
