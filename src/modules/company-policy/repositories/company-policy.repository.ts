import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { CompanyPolicy } from '../entities/company-policy.entity';
import { Status } from '../../../common/enums';

@Injectable()
export class CompanyPolicyRepository {

    constructor(
        @InjectRepository(CompanyPolicy)
        private readonly repository: Repository<CompanyPolicy>,
    ) { }

    async create(data: Partial<CompanyPolicy>): Promise<CompanyPolicy> {
        const policy = this.repository.create(data);
        return this.repository.save(policy);
    }

    async findByOrg(organizationId: string, status?: Status): Promise<CompanyPolicy[]> {
        const query = this.repository.createQueryBuilder('policy')
            .leftJoinAndSelect('policy.type', 'type')
            .where('policy.organization_id = :organizationId', { organizationId })
            .andWhere('policy.is_deleted = :isDeleted', { isDeleted: false });

        if (status) {
            query.andWhere('policy.status = :status', { status });
        }

        return query.orderBy('policy.created_at', 'DESC').getMany();
    }

    async findGroupedByOrg(organizationId: string, onlyActive: boolean = true): Promise<any[]> {
        const query = this.repository.createQueryBuilder('policy')
            .innerJoin('policy.type', 'type')
            .select([
                'type.id as type_id',
                'type.name as type_name',
                'type.icon as icon',
                'json_agg(json_build_object(\'id\', policy.id, \'title\', policy.title, \'updated_at\', policy.updated_at)) as policies',
                'count(policy.id) as policy_count'
            ])
            .where('policy.organization_id = :organizationId', { organizationId })
            .andWhere('policy.is_deleted = :isDeleted', { isDeleted: false });

        if (onlyActive) {
            query.andWhere('policy.status = :status', { status: Status.ACTIVE });
        }

        return query.groupBy('type.id, type.name, type.icon').getRawMany();
    }

    async findOneById(id: string, organizationId: string): Promise<CompanyPolicy | null> {
        return this.repository.findOne({
            where: {
                id,
                organization_id: organizationId,
                is_deleted: false,
            },
            relations: ['type'],
        });
    }

    async update(id: string, data: Partial<CompanyPolicy>): Promise<CompanyPolicy | null> {
        await this.repository.update(id, data);
        return this.repository.findOne({ where: { id }, relations: ['type'] });
    }

    async softDelete(id: string, deletedBy?: string): Promise<void> {
        await this.repository.update(id, {
            status: Status.INACTIVE,
            is_deleted: true,
            deleted_at: new Date(),
            deleted_by: deletedBy,
        } as any);
    }

    async countByTypeId(typeId: string): Promise<number> {
        return this.repository.count({
            where: {
                type_id: typeId,
                status: Status.ACTIVE,
                is_deleted: false,
            },
        });
    }
}
