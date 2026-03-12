import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindManyOptions, ILike } from 'typeorm';
import { Department } from '../entities/department.entity';
import { ListDepartmentsDto } from '../dto/list-departments.dto';
import { Status } from '../../../common/enums';

@Injectable()
export class DepartmentRepository {

    constructor(
        @InjectRepository(Department)
        private readonly repository: Repository<Department>,
    ) { }

    async create(data: Partial<Department>): Promise<Department> {
        const department = this.repository.create(data);
        return this.repository.save(department);
    }

    async findAllByOrg(
        organizationId: string,
        filters: ListDepartmentsDto = {},
    ): Promise<Department[]> {
        const {
            status,
            search,
            sort_by = 'created_at',
            sort_order = 'DESC',
        } = filters;

        const whereConditions: FindManyOptions<Department>['where'] = [];

        const base = {
            organization_id: organizationId,
            is_deleted: false,
            ...(status ? { status } : {}),
        };

        if (search) {
            whereConditions.push(
                { ...base, name: ILike(`%${search}%`) },
                { ...base, code: ILike(`%${search}%`) },
            );
        } else {
            whereConditions.push(base);
        }

        return this.repository.find({
            where: whereConditions,
            order: { [sort_by]: sort_order },
        });
    }

    async findOneByOrg(
        id: string,
        organizationId: string,
    ): Promise<Department | null> {
        return this.repository.findOne({
            where: {
                id,
                organization_id: organizationId,
                is_deleted: false,
            },
        });
    }

    async findByCode(
        organizationId: string,
        code: string,
    ): Promise<Department | null> {
        return this.repository.findOne({
            where: {
                organization_id: organizationId,
                code,
                is_deleted: false,
            },
        });
    }

    async update(
        id: string,
        updateData: Partial<Department>,
    ): Promise<Department | null> {
        await this.repository.update(id, updateData);
        return this.repository.findOne({ where: { id } });
    }

    async softDelete(id: string): Promise<void> {
        await this.repository.update(id, {
            is_deleted: true,
            status: Status.INACTIVE,
        });
    }

    async countByOrg(organizationId: string): Promise<number> {
        return this.repository.count({
            where: {
                organization_id: organizationId,
                is_deleted: false,
            },
        });
    }
}
