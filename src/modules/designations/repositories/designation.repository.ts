import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { Designation } from '../entities/designation.entity';
import { FindDesignationsDto } from '../dto/find-designations.dto';
import { Status } from '../../../common/enums/status.enum';

/**
 * Designation Repository
 *
 * Implements the Repository Pattern — all database queries live here.
 * No business rules, no HTTP concerns; pure data access only.
 */
@Injectable()
export class DesignationRepository {
    constructor(
        @InjectRepository(Designation)
        private readonly repository: Repository<Designation>,
    ) { }

    // Persist a new designation record to the database
    async create(data: Partial<Designation>): Promise<Designation> {
        const designation = this.repository.create(data);
        return this.repository.save(designation);
    }

    /**
     * Retrieve all designations for an organization.
     * Supports optional filtering by search string, status, and department.
     */
    async findAllByOrg(
        orgId: string,
        filters: FindDesignationsDto = {},
    ): Promise<Designation[]> {
        const query = this.repository
            .createQueryBuilder('designation')
            .where('designation.org_id = :orgId', { orgId })
            .andWhere('designation.is_deleted = :is_deleted', { is_deleted: false });

        // Apply status filter if provided
        if (filters.status) {
            query.andWhere('designation.status = :status', {
                status: filters.status,
            });
        }

        // Apply department filter if provided
        if (filters.department_id) {
            query.andWhere('designation.department_id = :departmentId', {
                departmentId: filters.department_id,
            });
        }

        // Apply search filter across title and code using ILIKE (case-insensitive)
        if (filters.search) {
            query.andWhere(
                '(designation.title ILIKE :search OR designation.code ILIKE :search)',
                { search: `%${filters.search}%` },
            );
        }

        // Always order by creation date descending
        query.orderBy('designation.created_at', 'DESC');

        return query.getMany();
    }

    // Find a single designation by its primary key
    async findById(id: string): Promise<Designation | null> {
        return this.repository.findOne({ where: { id } });
    }

    /**
     * Check whether a code already exists within an organization.
     * Used for code-uniqueness validation at creation time.
     */
    async findByOrgAndCode(
        orgId: string,
        code: string,
    ): Promise<Designation | null> {
        return this.repository.findOne({ where: { org_id: orgId, code } });
    }

    // Apply a partial update and return the refreshed record
    async update(
        id: string,
        data: Partial<Designation>,
    ): Promise<Designation | null> {
        await this.repository.update(id, data);
        return this.findById(id);
    }

    /**
     * Soft delete: mark the designation as INACTIVE.
     * The record remains in the database for historical reference.
     */
    async softDelete(id: string): Promise<void> {
        await this.repository.update(id, { status: Status.INACTIVE, is_deleted: true });
    }

    // Quick boolean existence check by primary key
    async existsById(id: string): Promise<boolean> {
        const count = await this.repository.count({ where: { id } });
        return count > 0;
    }
}
