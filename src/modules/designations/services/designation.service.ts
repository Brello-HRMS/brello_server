import {
    Injectable,
    NotFoundException,
    BadRequestException,
    Logger,
} from '@nestjs/common';
import { DesignationRepository } from '../repositories/designation.repository';
import { OrganizationService } from '../../organization/services/organization.service';
import { SearchIndexingService } from '../../global-search/services/search-indexing.service';
import { CreateDesignationDto } from '../dto/create-designation.dto';
import { UpdateDesignationDto } from '../dto/update-designation.dto';
import { FindDesignationsDto } from '../dto/find-designations.dto';
import { Designation } from '../entities/designation.entity';

/**
 * Designation Service
 *
 * Owns all business logic for designation management.
 * Delegates database queries to DesignationRepository
 * and cross-module lookups to OrganizationService.
 */
@Injectable()
export class DesignationService {
    private readonly logger = new Logger(DesignationService.name);

    constructor(
        private readonly designationRepository: DesignationRepository,
        private readonly organizationService: OrganizationService,
        private readonly searchIndexingService: SearchIndexingService,
    ) { }

    /**
     * Create a new designation.
     *
     * Business rules enforced:
     * 1. The target organization must exist.
     * 2. The code must be unique within that organization.
     */
    async create(orgId: string, enterpriseId: string, dto: CreateDesignationDto): Promise<Designation> {
        this.logger.log(
            `Creating designation "${dto.code}" for org ${orgId}`,
        );

        // Rule 1: ensure the organization actually exists
        await this.organizationService.findOne(orgId);

        // Rule 2: code must be unique within this org
        const existing = await this.designationRepository.findByOrgAndCode(
            orgId,
            dto.code.toUpperCase(),
        );
        if (existing) {
            throw new BadRequestException(
                `Designation code "${dto.code}" already exists in this organization`,
            );
        }

        // Normalize code to uppercase for consistency
        const designation = await this.designationRepository.create({
            ...dto,
            org_id: orgId,
            enterprise_id: enterpriseId,
            code: dto.code.toUpperCase(),
        });

        this.logger.log(`Designation created: ${designation.id}`);
        this.searchIndexingService.indexDesignation(designation, enterpriseId, orgId);
        return designation;
    }

    /**
     * List all designations for an organization.
     * Supports optional search, status, and department filters.
     */
    async findAll(
        orgId: string,
        filters: FindDesignationsDto,
    ): Promise<Designation[]> {
        this.logger.log(`Fetching designations for org ${orgId}`);

        // Ensure the org exists before returning data
        await this.organizationService.findOne(orgId);

        return this.designationRepository.findAllByOrg(orgId, filters);
    }

    /**
     * Fetch a single designation by its ID and Organization ID.
     * Throws NotFoundException if not found.
     */
    async findOne(id: string, orgId: string): Promise<Designation> {
        this.logger.log(`Fetching designation ${id} for org ${orgId}`);

        const designation = await this.designationRepository.findById(id);

        // Data isolation check: ensure the designation belongs to the organization
        if (!designation || designation.org_id !== orgId) {
            throw new NotFoundException(
                `Designation with ID "${id}" not found in this organization`,
            );
        }

        return designation;
    }

    /**
     * Update a designation.
     *
     * Business rules enforced:
     * - `code` is immutable — ignored even if provided in the payload.
     * - Only designations belonging to the orgId can be updated.
     */
    async update(id: string, orgId: string, enterpriseId: string, dto: UpdateDesignationDto): Promise<Designation> {
        this.logger.log(`Updating designation ${id} for org ${orgId}`);

        // Verify the designation exists and belongs to the organization
        await this.findOne(id, orgId);

        // Strip immutable fields to enforce the PRD constraint
        const { code: _code, ...allowedUpdates } = dto;

        const updated = await this.designationRepository.update(
            id,
            allowedUpdates,
        );

        if (!updated) {
            throw new NotFoundException(
                `Designation "${id}" not found after update`,
            );
        }

        this.logger.log(`Designation updated: ${id}`);
        this.searchIndexingService.indexDesignation(updated, enterpriseId, orgId);
        return updated;
    }

    async remove(id: string, orgId: string, enterpriseId: string): Promise<void> {
        this.logger.log(`Soft-deleting designation ${id} for org ${orgId}`);

        await this.findOne(id, orgId);

        await this.designationRepository.softDelete(id);
        this.searchIndexingService.removeDesignation(id, enterpriseId);

        this.logger.log(`Designation soft-deleted: ${id}`);
    }
}
