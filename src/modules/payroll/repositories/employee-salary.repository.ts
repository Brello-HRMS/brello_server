import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmployeeSalary } from '../entities/employee-salary.entity';
import { EmployeeSalaryComponent } from '../entities/employee-salary-component.entity';
import { User } from '../../user/entities/user.entity';
import { EmployeeQueryDto } from '../dto/employee-listing.dto';
import { ComponentType, CalculationType } from '../enums/payroll.enum';

export interface SalaryComponentSnapshot {
  component_name: string;
  component_type: ComponentType;
  value: number;
  calculation_type: CalculationType;
  calculate_from?: string;
  is_residual: boolean;
  calculation_priority: number;
}

export interface CreateSalaryVersionPayload {
  user_id: string;
  ctc: number;
  effective_from: Date;
  enterprise_id: string;
  organization_id: string;
  components: SalaryComponentSnapshot[];
}

@Injectable()
export class EmployeeSalaryRepository {
  constructor(
    @InjectRepository(EmployeeSalary)
    private readonly salaryRepo: Repository<EmployeeSalary>,
    @InjectRepository(EmployeeSalaryComponent)
    private readonly componentRepo: Repository<EmployeeSalaryComponent>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async findActiveSalary(userId: string): Promise<EmployeeSalary | null> {
    return this.salaryRepo.findOne({
      where: { user_id: userId, is_active: true },
    });
  }

  async findSalaryHistory(userId: string): Promise<EmployeeSalary[]> {
    return this.salaryRepo.find({
      where: { user_id: userId },
      order: { version_number: 'DESC' },
    });
  }

  async findSalaryWithComponents(salaryId: string): Promise<EmployeeSalary | null> {
    return this.salaryRepo.findOne({
      where: { id: salaryId },
      relations: ['components'],
    });
  }

  async createNewVersion(payload: CreateSalaryVersionPayload): Promise<EmployeeSalary> {
    const existing = await this.salaryRepo.findOne({
      where: { user_id: payload.user_id, is_active: true },
    });

    let nextVersion = 1;

    if (existing) {
      const effectiveTo = new Date(payload.effective_from);
      effectiveTo.setDate(effectiveTo.getDate() - 1);
      existing.effective_to = effectiveTo;
      existing.is_active = false;
      await this.salaryRepo.save(existing);
      nextVersion = existing.version_number + 1;
    }

    const salary = this.salaryRepo.create({
      user_id: payload.user_id,
      ctc: payload.ctc,
      effective_from: payload.effective_from,
      version_number: nextVersion,
      is_active: true,
      enterprise_id: payload.enterprise_id,
      organization_id: payload.organization_id,
    });

    const saved = await this.salaryRepo.save(salary);

    const componentEntities = payload.components.map((c) =>
      this.componentRepo.create({
        employee_salary_id: saved.id,
        component_name: c.component_name,
        component_type: c.component_type,
        value: c.value,
        calculation_type: c.calculation_type,
        calculate_from: c.calculate_from ?? undefined,
        is_residual: c.is_residual,
        calculation_priority: c.calculation_priority,
        enterprise_id: payload.enterprise_id,
        organization_id: payload.organization_id,
      }),
    );

    await this.componentRepo.save(componentEntities);
    return saved;
  }

  async findUserWithProfile(userId: string): Promise<User | null> {
    return this.userRepo
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.user_profile', 'profile')
      .leftJoinAndMapOne(
        'user.department',
        'departments',
        'dept',
        'dept.id = user.department_id',
      )
      .where('user.id = :userId', { userId })
      .getOne();
  }

  async queryEmployeesList(
    enterpriseId: string,
    orgId: string,
    query: EmployeeQueryDto,
  ) {
    const qb = this.userRepo
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.user_profile', 'profile')
      .leftJoinAndMapOne(
        'user.department',
        'departments',
        'dept',
        'dept.id = user.department_id',
      )
      .where('user.enterprise_id = :enterpriseId', { enterpriseId })
      .andWhere('user.organization_id = :orgId', { orgId })
      .andWhere('profile.type = :type', { type: 'EMPLOYEE' });

    if (query.department_id) {
      qb.andWhere('user.department_id = :deptId', { deptId: query.department_id });
    }
    if (query.search) {
      qb.andWhere(
        '(user.first_name ILIKE :search OR user.last_name ILIKE :search OR profile.employee_id ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    const { page = 1, limit = 10 } = query;
    qb.skip((page - 1) * limit).take(limit);

    return qb.getManyAndCount();
  }

  async findComponentsByOrgForPropagation(
    enterpriseId: string,
    organizationId: string,
    componentName: string,
  ): Promise<EmployeeSalaryComponent[]> {
    return this.componentRepo
      .createQueryBuilder('comp')
      .innerJoin('comp.employee_salary', 'sal', 'sal.is_active = true')
      .where('sal.enterprise_id = :enterpriseId', { enterpriseId })
      .andWhere('sal.organization_id = :organizationId', { organizationId })
      .andWhere('comp.component_name = :componentName', { componentName })
      .select(['comp', 'sal.id', 'sal.user_id'])
      .getMany();
  }
}
