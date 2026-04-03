import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmployeeSalary } from '../entities/employee-salary.entity';
import {
  AssignEmployeeSalaryDto,
  UpdateEmployeeSalaryDto,
} from '../dto/employee-salary.dto';
import { EmployeeQueryDto } from '../dto/employee-listing.dto';
import { SalaryTemplateEngine } from './salary-template.service';
import { SalaryStructureBuilder } from '../utils/salary-structure-builder.util';
import { EmployeeSalaryRepository } from '../repositories/employee-salary.repository';
import { ComponentType } from '../enums/payroll.enum';

@Injectable()
export class EmployeeSalaryEngine {
  constructor(
    private readonly employeeSalaryRepository: EmployeeSalaryRepository,
    private readonly templateEngine: SalaryTemplateEngine,
  ) {}

  async assignSalary(
    enterpriseId: string,
    organizationId: string,
    dto: AssignEmployeeSalaryDto,
  ): Promise<EmployeeSalary> {
    const template = await this.templateEngine.getTemplateById(dto.template_id);

    // Build materialized salary structure breakdown using shared utility
    const salaryStructure = SalaryStructureBuilder.build(
      template,
      dto.ctc,
      dto.overrides,
    );

    const employeeSalary = await this.employeeSalaryRepository.createSalary({
      user_id: dto.user_id,
      template_id: dto.template_id,
      ctc: dto.ctc,
      salary_structure: salaryStructure,
      effective_from: new Date(dto.effective_from),
      enterprise_id: enterpriseId,
      organization_id: organizationId,
    });

    return employeeSalary;
  }

  async getEmployeeSalary(userId: string): Promise<EmployeeSalary> {
    const salary =
      await this.employeeSalaryRepository.findSalaryByUserId(userId);

    if (!salary) {
      throw new NotFoundException('Employee salary structure not found.');
    }

    return salary;
  }

  async getEmployeesList(
    enterpriseId: string,
    orgId: string,
    query: EmployeeQueryDto,
  ) {
    const [users, total] =
      await this.employeeSalaryRepository.queryEmployeesList(
        enterpriseId,
        orgId,
        query,
      );

    const data = users.map((u: any) => ({
      id: u.id,
      name: u.fullName,
      employee_code: u.user_profile?.employee_id || null,
      department: u.department?.name || null,
    }));

    return { data, total, page: query.page || 1, limit: query.limit || 10 };
  }

  async getEmployeeSalaryStructure(userId: string) {
    const user =
      await this.employeeSalaryRepository.findUserWithProfile(userId);

    if (!user) throw new NotFoundException('Employee not found');

    const salary =
      await this.employeeSalaryRepository.findSalaryByUserId(userId);

    if (!salary) {
      return {
        employee: {
          name: user.fullName,
          employee_code: user.user_profile?.employee_id || null,
        },
        components: [],
      };
    }

    const componentsMaster =
      await this.employeeSalaryRepository.findComponentsMaster(
        user.enterprise_id,
        user.organization_id,
      );

    const masterMap = new Map(componentsMaster.map((c) => [c.code, c]));

    const mappedComponents: any[] = [];
    if (salary.salary_structure && salary.salary_structure.components) {
      for (const comp of Object.values(
        salary.salary_structure.components,
      ) as any[]) {
        const master = masterMap.get(comp.code);
        mappedComponents.push({
          code: comp.code,
          name: master?.name || comp.name || comp.code,
          type: master?.type || comp.type,
          value: comp.value,
          is_editable: master ? master.is_editable : false,
        });
      }
    }

    return {
      employee: {
        name: user.fullName,
        employee_code: user.user_profile?.employee_id || null,
      },
      components: mappedComponents,
    };
  }

  async updateEmployeeSalaryStructure(
    enterpriseId: string,
    orgId: string,
    userId: string,
    dto: UpdateEmployeeSalaryDto,
  ) {
    const salary =
      await this.employeeSalaryRepository.findSalaryByUserId(userId);

    if (!salary)
      throw new NotFoundException('Employee salary structure not found.');

    const componentsMaster =
      await this.employeeSalaryRepository.findComponentsMaster(
        enterpriseId,
        orgId,
      );
    const masterMap = new Map(componentsMaster.map((c) => [c.code, c]));

    const structure = salary.salary_structure;
    if (!structure.components) structure.components = {};

    for (const update of dto.components) {
      const master = masterMap.get(update.code);
      if (!master)
        throw new BadRequestException(`Invalid component code: ${update.code}`);

      if (!master.is_editable) {
        throw new BadRequestException(
          `Component ${update.code} is not editable.`,
        );
      }

      const compVal = {
        ...structure.components[update.code],
        value: update.value,
        code: update.code,
        type: master.type,
        name: master.name,
      };

      structure.components[update.code] = compVal;
    }

    let totalEarnings = 0;
    let totalDeductions = 0;

    for (const c of Object.values(structure.components) as any[]) {
      if (c.type === ComponentType.EARNING) totalEarnings += Number(c.value);
      if (c.type === ComponentType.DEDUCTION)
        totalDeductions += Number(c.value);
    }

    structure.total_earnings = totalEarnings;
    structure.total_deductions = totalDeductions;
    structure.net_salary = totalEarnings - totalDeductions;

    salary.salary_structure = structure;

    await this.employeeSalaryRepository.saveSalary(salary);
    return { message: 'Salary updated successfully' };
  }
}
