import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { CompanyPolicyType } from '../entities/company-policy-type.entity';
import { Status } from '../../../common/enums';

@Injectable()
export class CompanyPolicyTypeRepository {

    constructor(
        @InjectRepository(CompanyPolicyType)
        private readonly repository: Repository<CompanyPolicyType>,
    ) { }

    async create(data: Partial<CompanyPolicyType>): Promise<CompanyPolicyType> {
        const type = this.repository.create(data);
        return this.repository.save(type);
    }

    async findActiveByOrg(organizationId: string): Promise<CompanyPolicyType[]> {
        return this.repository.createQueryBuilder('type')
            .where('type.status = :status', { status: Status.ACTIVE })
            .andWhere('(type.organization_id = :organizationId OR type.is_system = true)', { organizationId })
            .andWhere('type.is_deleted = :isDeleted', { isDeleted: false })
            .orderBy('type.name', 'ASC')
            .getMany();
    }

    async findOneById(id: string, organizationId?: string): Promise<CompanyPolicyType | null> {
        const where: any = { id, is_deleted: false };
        if (organizationId) {
            where.organization_id = organizationId;
        }
        return this.repository.findOne({ where });
    }

    async update(id: string, data: Partial<CompanyPolicyType>): Promise<CompanyPolicyType | null> {
        await this.repository.update(id, data);
        return this.repository.findOne({ where: { id } });
    }

    async softDelete(id: string, deletedBy?: string): Promise<void> {
        await this.repository.update(id, {
            status: Status.INACTIVE,
            is_deleted: true,
            deleted_at: new Date(),
            deleted_by: deletedBy,
        } as any);
    }

    // Helper to check if name exists for the org
    async findByName(name: string, organizationId: string): Promise<CompanyPolicyType | null> {
        return this.repository.findOne({
            where: {
                name,
                organization_id: organizationId,
                status: Status.ACTIVE,
                is_deleted: false,
            },
        });
    }
}
