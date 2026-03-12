import {
    Injectable,
    NotFoundException,
    BadRequestException,
    ConflictException,
    Logger,
} from '@nestjs/common';

import { DepartmentRepository } from '../repositories/department.repository';
import { UserService } from '../../user/services/user.service';
import { CreateDepartmentDto } from '../dto/create-department.dto';
import { UpdateDepartmentDto } from '../dto/update-department.dto';
import { ListDepartmentsDto } from '../dto/list-departments.dto';
import { Department } from '../entities/department.entity';
import { Status } from '../../../common/enums';

@Injectable()
export class DepartmentService {

    private readonly logger = new Logger(DepartmentService.name);

    constructor(
        private readonly departmentRepository: DepartmentRepository,
        private readonly userService: UserService,
    ) { }

    private async resolveOrgId(userId: string): Promise<string> {
        const user = await this.userService.findOne(userId);

        if (!user || !user.organization_id) {
            throw new BadRequestException(
                'User is not associated with any organization',
            );
        }
        return user.organization_id;
    }

    async create(
        userId: string,
        createDepartmentDto: CreateDepartmentDto,
    ): Promise<Department> {
        this.logger.log(`User ${userId} is creating department: ${createDepartmentDto.code}`);

        const organizationId = await this.resolveOrgId(userId);

        const existing = await this.departmentRepository.findByCode(
            organizationId,
            createDepartmentDto.code,
        );
        if (existing) {
            throw new ConflictException(
                `Department with code '${createDepartmentDto.code}' already exists in this organization`,
            );
        }

        const status = createDepartmentDto.status ?? Status.ACTIVE;

        const department = await this.departmentRepository.create({
            ...createDepartmentDto,
            organization_id: organizationId,
            status,
            is_deleted: false,
            modified_by: userId,
        });

        this.logger.log(
            `[AUDIT] Department created | id=${department.id} | code=${department.code} | org=${organizationId} | by=${userId}`,
        );

        return department;
    }

    async findAll(
        userId: string,
        filters: ListDepartmentsDto,
    ): Promise<Department[]> {
        this.logger.log(`User ${userId} is listing departments`);

        const organizationId = await this.resolveOrgId(userId);

        return this.departmentRepository.findAllByOrg(organizationId, filters);
    }

    async findOne(userId: string, id: string): Promise<Department> {
        this.logger.log(`User ${userId} is fetching department: ${id}`);

        const organizationId = await this.resolveOrgId(userId);

        const department = await this.departmentRepository.findOneByOrg(
            id,
            organizationId,
        );

        if (!department) {
            throw new NotFoundException(`Department with ID '${id}' not found`);
        }

        return department;
    }

    async update(
        userId: string,
        id: string,
        updateDepartmentDto: UpdateDepartmentDto,
    ): Promise<Department> {
        this.logger.log(`User ${userId} is updating department: ${id}`);

        await this.findOne(userId, id);

        const { ...safeUpdate } = updateDepartmentDto;

        const updated = await this.departmentRepository.update(id, {
            ...safeUpdate,
            modified_by: userId,
        });

        if (!updated) {
            throw new NotFoundException(
                `Department with ID '${id}' not found after update`,
            );
        }

        this.logger.log(
            `[AUDIT] Department updated | id=${id} | by=${userId} | fields=${Object.keys(safeUpdate).join(', ')}`,
        );

        return updated;
    }

    async remove(userId: string, id: string): Promise<void> {
        this.logger.log(`User ${userId} is soft-deleting department: ${id}`);

        await this.findOne(userId, id);

        // TODO (Phase 2): Block deletion if active employees are assigned to this department
        // const activeEmployeeCount = await this.employeeRepository.countByDepartment(id);
        // if (activeEmployeeCount > 0) {
        //   throw new BadRequestException(
        //     'Cannot delete department with active employees. Reassign them first.',
        //   );
        // }

        await this.departmentRepository.softDelete(id);

        this.logger.log(
            `[AUDIT] Department soft-deleted | id=${id} | by=${userId}`,
        );
    }
}
