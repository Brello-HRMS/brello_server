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
import { SetupCompanyDto } from '../dto/setup-company.dto';
import { DataSource } from 'typeorm';
import { UserRoleMap } from '../../rbac/entities/user-role-map.entity';
import {
  OrganizationSubscription,
  SubscriptionStatus,
} from '../../plan/entities/organization-subscription.entity';
import { UserRepository } from 'src/modules/user/repositories/user.repository';
import { OrganizationProfileRepository } from '../repositories/organization-profile.repository';
import { Status } from 'src/common/enums';
import { Role } from 'src/modules/role/entities/role.entity';

// Organization Service - Implements business logic for organization management
@Injectable()
export class OrganizationService {
  private readonly logger = new Logger(OrganizationService.name);

  constructor(
    private readonly organizationRepository: OrganizationRepository,
    private readonly enterpriseService: EnterpriseService,
    private readonly organizationProfileRepository: OrganizationProfileRepository,
    private readonly dataSource: DataSource,
    private readonly userRepository: UserRepository,
  ) {}

  // Set up an organization (6-step flow after user registration)
  async setupCompany(dto: SetupCompanyDto): Promise<void> {
    const userId = dto.user_id;

    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    if (user.organization_id) {
      throw new BadRequestException('User already has an organization setup');
    }

    this.logger.log(`Starting company setup for user: ${userId}`);

    // Validate subdomain uniqueness
    const existingOrg = await this.organizationRepository.findBySubdomain(
      dto.subdomain,
    );
    if (existingOrg.length > 0) {
      throw new BadRequestException('Subdomain is already taken');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const manager = queryRunner.manager;

      // Step 1: Create Organization
      const savedOrg = await this.organizationRepository.create({
        name: dto.name,
        subdomain: dto.subdomain,
      });

      // Step 2: Create OrganizationProfile
      const profile = await this.organizationProfileRepository.create({
        organization: savedOrg,
        name: dto.name,
        email: user.email,
        phone: user.phone,
        industry_type_id: dto.business_type_id,
      });
      await manager.save(profile);

      // Step 3: Find 'Org Admin' role
      const adminRole = await manager.findOne(Role, {
        where: { name: 'Organization Admin', status: Status.ACTIVE },
      });
      if (!adminRole) {
        throw new NotFoundException(
          'System role "Organization Admin" not found. Setup incomplete.',
        );
      }

      // Step 4: Create UserRoleMap
      const urm = manager.create(UserRoleMap, {
        user_id: user.id,
        role_id: adminRole.id,
        organization_id: savedOrg.id,
      });
      await manager.save(urm);

      // Step 5: Update User
      user.organization_id = savedOrg.id;
      await manager.save(user);

      // Step 6: Create OrganizationSubscription
      if (!user.plan_id) {
        this.logger.warn(`User ${user.id} has no plan_id assigned.`);

        throw new BadRequestException('User does not have a plan assigned');
      }

      const subscription = manager.create(OrganizationSubscription, {
        organization_id: savedOrg.id,
        plan_id: user.plan_id,
        sub_status: SubscriptionStatus.ACTIVE,
        start_date: new Date(),
      });

      // Since prompt says 'trial', let's check SubscriptionStatus enum: it has ACTIVE, EXPIRED, CANCELLED. We'll use ACTIVE for now if TRIAL isn't there.
      // And we set end_date
      const trialEndDate = new Date();
      trialEndDate.setDate(trialEndDate.getDate() + 14); // 14 days trial
      subscription.end_date = trialEndDate;
      await manager.save(subscription);

      await queryRunner.commitTransaction();
      this.logger.log(
        `Company setup completed successfully for org: ${savedOrg.id}`,
      );
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Failed to setup company for user ${userId}`,
        error.stack,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
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
    await this.enterpriseService.findOneById(enterpriseId);

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
      await this.enterpriseService.findOneById(
        updateOrganizationDto.enterprise_id,
      );
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
