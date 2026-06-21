import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Department } from '../../departments/entities/department.entity';
import { Status } from '../../../common/enums';
import { CreatePlatformDepartmentDto } from '../dto/create-platform-department.dto';
import { UpdatePlatformDepartmentDto } from '../dto/update-platform-department.dto';
import { AuditContextService } from '../../audit/services/audit-context.service';

@Injectable()
export class PlatformDepartmentService {
  constructor(
    @InjectRepository(Department)
    private readonly departmentRepository: Repository<Department>,
    private readonly auditContext: AuditContextService,
  ) {}

  async findAll(): Promise<Department[]> {
    return this.departmentRepository.find({
      where: { is_default: true, is_deleted: false },
      order: { name: 'ASC' },
    });
  }

  async findOne(id: string): Promise<Department> {
    const department = await this.departmentRepository.findOne({
      where: { id, is_default: true, is_deleted: false },
    });
    if (!department) {
      throw new NotFoundException(`Default department with id '${id}' not found`);
    }
    return department;
  }

  async create(createDto: CreatePlatformDepartmentDto): Promise<Department> {
    const existingDepartment = await this.departmentRepository.findOne({
      where: { code: createDto.code.toUpperCase(), is_default: true, is_deleted: false },
    });
    if (existingDepartment) {
      throw new ConflictException(`A default department with code '${createDto.code}' already exists`);
    }

    const newDepartment = this.departmentRepository.create({
      ...createDto,
      code: createDto.code.toUpperCase(),
      status: createDto.status ?? Status.ACTIVE,
      is_default: true,
      is_deleted: false,
    });
    return this.departmentRepository.save(newDepartment);
  }

  async update(id: string, updateDto: UpdatePlatformDepartmentDto): Promise<Department> {
    const department = await this.findOne(id);
    this.auditContext.setPreValue(department as unknown as Record<string, unknown>);
    Object.assign(department, updateDto);
    return this.departmentRepository.save(department);
  }

  async remove(id: string): Promise<void> {
    const department = await this.findOne(id);
    this.auditContext.setPreValue(department as unknown as Record<string, unknown>);
    department.is_deleted = true;
    department.status = Status.DELETED;
    await this.departmentRepository.save(department);
  }
}
