import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { OrganizationRepository } from '../repositories/organization.repository';
import { EnterpriseService } from '../../enterprise/services/enterprise.service';
import { CreateOrganizationDto } from '../dto/create-organization.dto';
import { UpdateOrganizationDto } from '../dto/update-organization.dto';
import { Organization } from '../entities/organization.entity';

// Organization Service - Implements business logic for organization management
@Injectable()
export class OrganizationService {
  private readonly logger = new Logger(OrganizationService.name);

  constructor(
    private readonly organizationRepository: OrganizationRepository,
    private readonly enterpriseService: EnterpriseService,
  ) {}

  // Create a new organization
  async create(
    createOrganizationDto: CreateOrganizationDto,
  ): Promise<Organization> {
    this.logger.log(`Creating organization: ${createOrganizationDto.name}`);

    // Validate that the enterprise exists
    await this.enterpriseService.findOne(createOrganizationDto.enterprise_id);

    const organization = await this.organizationRepository.create(
      createOrganizationDto,
    );

    this.logger.log(`Organization created successfully: ${organization.id}`);
    return organization;
  }

  // Get all organizations
  async findAll(): Promise<Organization[]> {
    this.logger.log('Fetching all organizations');
    return this.organizationRepository.findAll();
  }

  // Get organization by ID
  async findOne(id: string): Promise<Organization> {
    this.logger.log(`Fetching organization: ${id}`);

    const organization = await this.organizationRepository.findById(id);

    if (!organization) {
      throw new NotFoundException(`Organization with ID '${id}' not found`);
    }

    return organization;
  }

  // Get organizations by enterprise ID
  async findByEnterpriseId(enterpriseId: string): Promise<Organization[]> {
    this.logger.log(`Fetching organizations for enterprise: ${enterpriseId}`);

    // Validate that the enterprise exists
    await this.enterpriseService.findOne(enterpriseId);

    return this.organizationRepository.findByEnterpriseId(enterpriseId);
  }

  // Update an organization
  async update(
    id: string,
    updateOrganizationDto: UpdateOrganizationDto,
  ): Promise<Organization> {
    this.logger.log(`Updating organization: ${id}`);

    // Verify organization exists
    await this.findOne(id);

    // If enterprise_id is being updated, validate the new enterprise exists
    if (updateOrganizationDto.enterprise_id) {
      await this.enterpriseService.findOne(updateOrganizationDto.enterprise_id);
    }

    const updatedOrganization = await this.organizationRepository.update(
      id,
      updateOrganizationDto,
    );

    if (!updatedOrganization) {
      throw new NotFoundException(
        `Organization with ID '${id}' not found after update`,
      );
    }

    this.logger.log(`Organization updated successfully: ${id}`);
    return updatedOrganization;
  }

  // Delete an organization
  async remove(id: string): Promise<void> {
    this.logger.log(`Deleting organization: ${id}`);

    // Verify organization exists
    await this.findOne(id);

    const deleted = await this.organizationRepository.delete(id);

    if (!deleted) {
      throw new NotFoundException(
        `Failed to delete organization with ID '${id}'`,
      );
    }

    this.logger.log(`Organization deleted successfully: ${id}`);
  }
}
