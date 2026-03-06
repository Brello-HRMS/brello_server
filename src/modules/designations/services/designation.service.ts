import {
    Injectable,
    NotFoundException,
    BadRequestException,
    Logger,
} from '@nestjs/common';
import { DesignationRepository } from '../repositories/designation.repository';
import { OrganizationService } from '../../organization/services/organization.service';
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
    ) { }

    /**
     * Create a new designation.
     *
     * Business rules enforced:
     * 1. The target organization must exist.
     * 2. The code must be unique within that organization.
     */
    async create(dto: CreateDesignationDto): Promise<Designation> {
        this.logger.log(
            `Creating designation "${dto.code}" for org ${dto.org_id}`,
        );

        // Rule 1: ensure the organization actually exists
        await this.organizationService.findOne(dto.org_id);

        // Rule 2: code must be unique within this org
        const existing = await this.designationRepository.findByOrgAndCode(
            dto.org_id,
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
            code: dto.code.toUpperCase(),
        });

        this.logger.log(`Designation created: ${designation.id}`);
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
     * Fetch a single designation by its ID.
     * Throws NotFoundException if not found.
     */
    async findOne(id: string): Promise<Designation> {
        this.logger.log(`Fetching designation ${id}`);

        const designation = await this.designationRepository.findById(id);

        if (!designation) {
            throw new NotFoundException(
                `Designation with ID "${id}" not found`,
            );
        }

        return designation;
    }

    /**
     * Update a designation.
     *
     * Business rules enforced:
     * - `code` is immutable — ignored even if provided in the payload.
     * - `org_id` cannot be reassigned.
     */
    async update(id: string, dto: UpdateDesignationDto): Promise<Designation> {
        this.logger.log(`Updating designation ${id}`);

        // Verify the designation exists
        await this.findOne(id);

        // Strip immutable fields to enforce the PRD constraint
        const { code: _code, org_id: _orgId, ...allowedUpdates } = dto;

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
        return updated;
    }

    /**
     * Soft-delete a designation by setting its status to INACTIVE.
     *
     * Phase 1: performs the soft delete unconditionally.
     * Phase 2 (future): block deletion if active employees are linked.
     */
    async remove(id: string): Promise<void> {
        this.logger.log(`Soft-deleting designation ${id}`);

        // Ensure the designation exists before trying to delete
        await this.findOne(id);

        await this.designationRepository.softDelete(id);

        this.logger.log(`Designation soft-deleted: ${id}`);
    }
}
