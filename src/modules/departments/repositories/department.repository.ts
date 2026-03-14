import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
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

    getListingQueryBuilder(alias: string = 'department'): SelectQueryBuilder<Department> {
        return this.repository.createQueryBuilder(alias)
            .where(`${alias}.is_deleted = :isDeleted`, { isDeleted: false });
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

        const queryBuilder = this.getListingQueryBuilder('department')
            .andWhere('department.organization_id = :organizationId', { organizationId });

        if (status) {
            queryBuilder.andWhere('department.status = :status', { status });
        }

        if (search) {
            queryBuilder.andWhere(
                '(department.name ILIKE :search OR department.code ILIKE :search)',
                { search: `%${search}%` },
            );
        }

        queryBuilder.orderBy(`department.${sort_by}`, sort_order as any);

        return queryBuilder.getMany();
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
