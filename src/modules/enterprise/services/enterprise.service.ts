import {
    Injectable,
    NotFoundException,
    ConflictException,
    Logger,
} from '@nestjs/common';
import { EnterpriseRepository } from '../repositories/enterprise.repository';
import { CreateEnterpriseDto } from '../dto/create-enterprise.dto';
import { UpdateEnterpriseDto } from '../dto/update-enterprise.dto';
import { Enterprise } from '../entities/enterprise.entity';

// Enterprise Service - Implements business logic for enterprise management
@Injectable()
export class EnterpriseService {
    private readonly logger = new Logger(EnterpriseService.name);

    constructor(private readonly enterpriseRepository: EnterpriseRepository) { }

    // Create a new enterprise
    async create(createEnterpriseDto: CreateEnterpriseDto): Promise<Enterprise> {
        this.logger.log(`Creating enterprise: ${createEnterpriseDto.name}`);

        // Check if domain already exists
        const existingEnterprise = await this.enterpriseRepository.findByDomain(
            createEnterpriseDto.domain,
        );

        if (existingEnterprise) {
            throw new ConflictException(
                `Enterprise with domain '${createEnterpriseDto.domain}' already exists`,
            );
        }

        const enterprise = await this.enterpriseRepository.create(
            createEnterpriseDto,
        );

        this.logger.log(`Enterprise created successfully: ${enterprise.id}`);
        return enterprise;
    }

    // Get all enterprises
    async findAll(): Promise<Enterprise[]> {
        this.logger.log('Fetching all enterprises');
        return this.enterpriseRepository.findAll();
    }

    // Get enterprise by ID
    async findOne(id: string): Promise<Enterprise> {
        this.logger.log(`Fetching enterprise: ${id}`);

        const enterprise = await this.enterpriseRepository.findById(id);

        if (!enterprise) {
            throw new NotFoundException(`Enterprise with ID '${id}' not found`);
        }

        return enterprise;
    }

    // Update an enterprise
    async update(
        id: string,
        updateEnterpriseDto: UpdateEnterpriseDto,
    ): Promise<Enterprise> {
        this.logger.log(`Updating enterprise: ${id}`);

        // Verify enterprise exists
        await this.findOne(id);

        // If domain is being updated, check for conflicts
        if (updateEnterpriseDto.domain) {
            const existingEnterprise = await this.enterpriseRepository.findByDomain(
                updateEnterpriseDto.domain,
            );

            if (existingEnterprise && existingEnterprise.id !== id) {
                throw new ConflictException(
                    `Enterprise with domain '${updateEnterpriseDto.domain}' already exists`,
                );
            }
        }

        const updatedEnterprise = await this.enterpriseRepository.update(
            id,
            updateEnterpriseDto,
        );

        if (!updatedEnterprise) {
            throw new NotFoundException(`Enterprise with ID '${id}' not found after update`);
        }

        this.logger.log(`Enterprise updated successfully: ${id}`);
        return updatedEnterprise;
    }

    // Delete an enterprise
    async remove(id: string): Promise<void> {
        this.logger.log(`Deleting enterprise: ${id}`);

        // Verify enterprise exists
        await this.findOne(id);

        const deleted = await this.enterpriseRepository.delete(id);

        if (!deleted) {
            throw new NotFoundException(`Failed to delete enterprise with ID '${id}'`);
        }

        this.logger.log(`Enterprise deleted successfully: ${id}`);
    }
}
