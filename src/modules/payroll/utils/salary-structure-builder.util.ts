import { BadRequestException } from '@nestjs/common';
import { ComponentType, CalculationType } from '../enums/payroll.enum';
import { SalaryComponentSnapshot } from '../repositories/employee-salary.repository';

export class SalaryStructureBuilder {
  static build(
    template: any,
    ctc: number,
    componentIds?: string[],
    overrides?: Record<string, number>,
  ): SalaryComponentSnapshot[] {
    const templateComponents: any[] = template.components;

    // Build id → component lookup
    const compById = new Map<string, any>();
    for (const tc of templateComponents) {
      if (!componentIds || componentIds.includes(tc.component.id) || tc.component.name === 'CTC') {
        compById.set(tc.component.id, tc.component);
      }
    }

    // Seed context: CTC matched by name (entity has no 'code' field)
    const context = new Map<string, number>();
    const ctcComp = [...compById.values()].find((c) => c.name === 'CTC');
    if (ctcComp) {
      context.set(ctcComp.id, ctc);
    }

    const snapshot: SalaryComponentSnapshot[] = [];
    const resolved = new Set<string>();

    const resolve = (comp: any) => {
      if (resolved.has(comp.id)) return;

      // Resolve base component first if it is part of this template and allowed
      if (comp.calculate_from && compById.has(comp.calculate_from)) {
        resolve(compById.get(comp.calculate_from));
      }

      // Skip the CTC virtual root — it was already seeded into context above
      if (comp.name === 'CTC') {
        resolved.add(comp.id);
        return;
      }

      let value = 0;

      // Apply override if exists
      if (overrides && overrides[comp.name] !== undefined) {
        value = overrides[comp.name];
      } else {
        switch (comp.calculation_type as CalculationType) {
          case CalculationType.FIXED:
            value = Number(comp.value ?? 0);
            break;

          case CalculationType.PERCENTAGE: {
            const baseValue = comp.calculate_from
              ? (context.get(comp.calculate_from) ?? 0)
              : 0;
            value = (baseValue * Number(comp.value ?? 0)) / 100;
            break;
          }

          case CalculationType.RESIDUAL: {
            const totalEarnings = snapshot
              .filter((s) => s.component_type === ComponentType.EARNING)
              .reduce((sum, s) => sum + s.value, 0);
            value = Math.max(0, ctc - totalEarnings);
            break;
          }
        }
      }

      context.set(comp.id, value);
      resolved.add(comp.id);

      snapshot.push({
        component_name: comp.name,
        component_type: comp.component_type as ComponentType,
        value,
        calculation_type: comp.calculation_type as CalculationType,
        calculate_from: comp.base_component?.name ?? undefined,
        is_residual: comp.is_residual ?? false,
        calculation_priority: comp.calculation_priority ?? 0,
      });
    };

    // Process in priority order
    const sorted = [...templateComponents]
      .filter((tc) => compById.has(tc.component.id))
      .sort((a, b) => a.component.calculation_priority - b.component.calculation_priority);

    for (const tc of sorted) {
      resolve(tc.component);
    }

    // Validate that the total earnings do not exceed CTC (unless it is a residual component)
    const totalEarnings = snapshot
      .filter((s) => s.component_type === ComponentType.EARNING)
      .reduce((sum, s) => sum + s.value, 0);

    if (totalEarnings > ctc + 1) { // Adding +1 for floating point safety
      throw new BadRequestException(`Total components sum (${totalEarnings}) exceeds the defined CTC (${ctc}).`);
    }

    return snapshot;
  }
}
