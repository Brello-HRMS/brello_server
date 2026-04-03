import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmployeeSalary } from '../entities/employee-salary.entity';
import { User } from '../../user/entities/user.entity';
import { PayrollComponent } from '../entities/payroll-component.entity';
import { EmployeeQueryDto } from '../dto/employee-listing.dto';

@Injectable()
export class EmployeeSalaryRepository {
  constructor(
    @InjectRepository(EmployeeSalary)
    private readonly salaryRepo: Repository<EmployeeSalary>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(PayrollComponent)
    private readonly componentRepo: Repository<PayrollComponent>,
  ) {}

  async findSalaryByUserId(userId: string): Promise<EmployeeSalary | null> {
    return this.salaryRepo.findOne({
      where: { user_id: userId },
      order: { effective_from: 'DESC' },
    });
  }

  async saveSalary(salary: EmployeeSalary): Promise<EmployeeSalary> {
    return this.salaryRepo.save(salary);
  }

  async createSalary(data: Partial<EmployeeSalary>): Promise<EmployeeSalary> {
    const salary = this.salaryRepo.create(data);
    return this.salaryRepo.save(salary);
  }

  async findComponentsMaster(
    enterpriseId: string,
    orgId: string,
  ): Promise<PayrollComponent[]> {
    return this.componentRepo.find({
      where: { enterprise_id: enterpriseId, organization_id: orgId },
    });
  }

  async findUserWithProfile(userId: string): Promise<User | null> {
    return this.userRepo
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.user_profile', 'profile')
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
      qb.andWhere('user.department_id = :deptId', {
        deptId: query.department_id,
      });
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
}
