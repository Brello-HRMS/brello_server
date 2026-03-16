import {
    Injectable,
    NotFoundException,
    BadRequestException,
    ConflictException,
    Logger,
} from '@nestjs/common';

import { DepartmentRepository } from '../repositories/department.repository';
import { UserService } from '../../user/services/user.service';
import { UserRepository } from '../../user/repositories/user.repository';
import { CreateDepartmentDto } from '../dto/create-department.dto';
import { UpdateDepartmentDto } from '../dto/update-department.dto';
import { ListDepartmentsDto } from '../dto/list-departments.dto';
import { Department } from '../entities/department.entity';
import { Status } from '../../../common/enums';
import { LoggedInUser } from '../../auth/interfaces/logged-in-user.interface';
import { ListingHelper } from '../../../common/utils/listing.helper';

@Injectable()
export class DepartmentService {

    private readonly logger = new Logger(DepartmentService.name);

    constructor(
        private readonly departmentRepository: DepartmentRepository,
        private readonly userService: UserService,
        private readonly userRepository: UserRepository,
    ) { }

    // Simplified: resolveOrgId is no longer needed as organizationId is in LoggedInUser

    async create(
        user: LoggedInUser,
        createDepartmentDto: CreateDepartmentDto,
    ): Promise<Department> {
        this.logger.log(`User ${user.userId} is creating department: ${createDepartmentDto.code}`);

        const organizationId = user.organizationId;

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
            enterprise_id: user.enterpriseId,
            status,
            is_deleted: false,
            modified_by: user.userId,
        });

        this.logger.log(
            `[AUDIT] Department created | id=${department.id} | code=${department.code} | org=${organizationId} | by=${user.userId}`,
        );

        return department;
    }

    async findAll(
        user: LoggedInUser,
        query: ListDepartmentsDto,
    ) {
        this.logger.log(`User ${user.userId} is listing departments`);

        const qb = this.departmentRepository.getListingQueryBuilder('department');

        const response = await ListingHelper.apply(
            qb,
            query,
            user,
            {
                searchFields: ['name', 'code'],
                filterFields: ['status'],
                alias: 'department',
            },
        );

        // Fetch avatars for each department
        const departmentIds = response.data.map(d => d.id);
        const avatarMap = await this.userRepository.findAvatarsByDepartmentIds(departmentIds);

        // Map avatars back to departments
        const items = response.data.map(d => ({
            ...d,
            memberAvatars: avatarMap[d.id] || [],
        }));

        return {
            ...response,
            data: items,
        };
    }

    async findOne(user: LoggedInUser, id: string): Promise<Department> {
        this.logger.log(`User ${user.userId} is fetching department: ${id}`);

        const department = await this.departmentRepository.findOneByOrg(
            id,
            user.organizationId,
        );

        if (!department) {
            throw new NotFoundException(`Department with ID '${id}' not found`);
        }

        return department;
    }

    async update(
        user: LoggedInUser,
        id: string,
        updateDepartmentDto: UpdateDepartmentDto,
    ): Promise<Department> {
        this.logger.log(`User ${user.userId} is updating department: ${id}`);

        await this.findOne(user, id);

        const { ...safeUpdate } = updateDepartmentDto;

        const updated = await this.departmentRepository.update(id, {
            ...safeUpdate,
            modified_by: user.userId,
        });

        if (!updated) {
            throw new NotFoundException(
                `Department with ID '${id}' not found after update`,
            );
        }

        this.logger.log(
            `[AUDIT] Department updated | id=${id} | by=${user.userId} | fields=${Object.keys(safeUpdate).join(', ')}`,
        );

        return updated;
    }

    async remove(user: LoggedInUser, id: string): Promise<void> {
        this.logger.log(`User ${user.userId} is soft-deleting department: ${id}`);

        await this.findOne(user, id);

        // TODO (Phase 2): Block deletion if active employees are assigned to this department
        // const activeEmployeeCount = await this.employeeRepository.countByDepartment(id);
        // if (activeEmployeeCount > 0) {
        //   throw new BadRequestException(
        //     'Cannot delete department with active employees. Reassign them first.',
        //   );
        // }

        await this.departmentRepository.softDelete(id);

        this.logger.log(
            `[AUDIT] Department soft-deleted | id=${id} | by=${user.userId}`,
        );
    }
}
