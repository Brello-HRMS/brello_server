import { Injectable, NotFoundException } from '@nestjs/common';
import { UserRepository } from '../../../user/repositories/user.repository';
import { EmployeeSalaryEngine } from '../../../payroll/services/employee-salary.service';
import { OrganizationProfileService } from '../../../organization/services/organization-profile.service';
import { SignatoryRepository } from '../../signatories/repositories/signatory.repository';
import { LetterSettingsService } from '../../settings/services/letter-settings.service';
import type { LoggedInUser } from '../../../auth/interfaces/logged-in-user.interface';
import { VARIABLE_REGISTRY } from '../registry/variable-registry';
import { formatDate, formatCurrency } from '../utils/formatters';
import type {
  ResolvedVariables,
  SalaryTableModel,
  SignatoryModel,
} from '../interfaces/render-model.interface';

@Injectable()
export class VariableResolverService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly employeeSalaryEngine: EmployeeSalaryEngine,
    private readonly organizationProfileService: OrganizationProfileService,
    private readonly signatoryRepository: SignatoryRepository,
    private readonly letterSettingsService: LetterSettingsService,
  ) {}

  /**
   * Resolves every variable EXCEPT `letter_number`, which is only known once
   * the numbering service reserves it inside the generation transaction —
   * callers merge that in afterwards before building the render model.
   */
  async resolve(user: LoggedInUser, employeeId: string): Promise<ResolvedVariables> {
    const employee = await this.userRepository.findById(employeeId);
    if (!employee || employee.organization_id !== user.organizationId) {
      throw new NotFoundException(`Employee "${employeeId}" not found`);
    }

    const settings = await this.letterSettingsService.get(user);

    let ctc: number | string | null = null;
    try {
      const salary = await this.employeeSalaryEngine.getEmployeeSalaryStructure(employeeId);
      ctc = salary?.ctc ?? null;
    } catch {
      ctc = null;
    }

    const org = await this.organizationProfileService.findByOrganizationId(user.organizationId);

    const values: Record<string, string> = {
      employee_name: employee.fullName,
      employee_code: employee.user_profile?.employee_id ?? '',
      doj: formatDate(employee.user_profile?.joining_date, settings.date_format),
      designation: employee.designation?.title ?? '',
      department: employee.department?.name ?? '',
      ctc: formatCurrency(ctc),
      organization_name: org?.name ?? '',
      organization_address: [org?.address, org?.city, org?.state, org?.zip_code]
        .filter(Boolean)
        .join(', '),
      today_date: formatDate(new Date(), settings.date_format),
    };

    const missing = VARIABLE_REGISTRY.filter((v) => !v.nullable && !values[v.key]?.trim())
      .map((v) => v.key)
      // letter_number/signatory_* are resolved by separate steps, never "missing" here
      .filter((key) => !['letter_number', 'signatory_name', 'signatory_designation'].includes(key));

    return { values, missing };
  }

  async getSalaryTable(employeeId: string): Promise<SalaryTableModel | null> {
    try {
      const salary = await this.employeeSalaryEngine.getEmployeeSalaryStructure(employeeId);
      if (!salary || !salary.components?.length) return null;
      return {
        components: salary.components.map((c: { component_name: string; value: number | string }) => ({
          component_name: c.component_name,
          amount: c.value,
        })),
        total: salary.ctc ?? 0,
      };
    } catch {
      return null;
    }
  }

  async getSignatory(
    organizationId: string,
    signatoryId?: string | null,
  ): Promise<SignatoryModel | null> {
    let signatory = signatoryId
      ? await this.signatoryRepository.findOneByOrg(signatoryId, organizationId)
      : null;

    if (!signatory) {
      signatory = await this.signatoryRepository.findDefaultForOrg(organizationId);
    }

    if (!signatory) return null;
    return { name: signatory.name, designation: signatory.designation };
  }
}
