import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { OrganizationRepository } from '../repositories/organization.repository';
import { EnterpriseService } from '../../enterprise/services/enterprise.service';
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
import { OrganizationProfile } from '../entities/organization-profile.entity';
import { Status } from 'src/common/enums';
import { Role } from 'src/modules/role/entities/role.entity';
import { AuthService } from 'src/modules/auth/services/auth.service';
import { AuthResponseDto } from 'src/modules/auth/dto/auth-response.dto';

@Injectable()
export class OrganizationService {
  private readonly logger = new Logger(OrganizationService.name);

  constructor(
    private readonly organizationRepository: OrganizationRepository,
    private readonly enterpriseService: EnterpriseService,
    private readonly organizationProfileRepository: OrganizationProfileRepository,
    private readonly dataSource: DataSource,
    private readonly userRepository: UserRepository,
    private readonly authService: AuthService,
  ) {}

  async setupCompany(dto: SetupCompanyDto): Promise<AuthResponseDto> {
    const userId = dto.user_id;

    // Fail early checks before starting the transaction
    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    if (user.organization_id) {
      throw new BadRequestException('User already has an organization setup');
    }

    if (!user.plan_id) {
      this.logger.warn(`User ${user.id} has no plan assigned.`);
      throw new BadRequestException('User does not have a plan assigned');
    }

    this.logger.log(`Starting company setup for user: ${userId}`);

    const existingOrgBySubdomain =
      await this.organizationRepository.findBySubdomain(dto.subdomain);
    if (existingOrgBySubdomain.length > 0) {
      throw new BadRequestException('Subdomain is already taken');
    }

    const existingOrgByName = await this.organizationRepository.findByName(
      dto.name,
    );
    if (existingOrgByName) {
      throw new BadRequestException('Organization name is already taken');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const manager = queryRunner.manager;

      // Step 1: Create Organization
      const newOrg = manager.create(Organization, {
        name: dto.name,
        subdomain: dto.subdomain,
      });
      const savedOrg = await manager.save(newOrg);

      // Step 2: Create OrganizationProfile
      const profile = manager.create(OrganizationProfile, {
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
      const subscription = manager.create(OrganizationSubscription, {
        organization_id: savedOrg.id,
        plan_id: user.plan_id,
        sub_status: SubscriptionStatus.ACTIVE,
        start_date: new Date(),
      });

      const trialEndDate = new Date();
      trialEndDate.setDate(trialEndDate.getDate() + 14); // 14 days trial
      subscription.end_date = trialEndDate;
      await manager.save(subscription);

      await queryRunner.commitTransaction();
      this.logger.log(
        `Company setup completed successfully for org: ${savedOrg.id}`,
      );

      return this.authService.buildAuthResponse(user);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Failed to setup company for user ${userId}: ${error.message}`,
        error.stack,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(): Promise<Organization[]> {
    this.logger.log('Fetching all organizations');
    return this.organizationRepository.findAll();
  }

  async findOne(id: string): Promise<Organization> {
    this.logger.log(`Fetching organization: ${id}`);

    const organization = await this.organizationRepository.findById(id);

    if (!organization) {
      throw new NotFoundException(`Organization with ID '${id}' not found`);
    }

    return organization;
  }

  async findByName(name: string): Promise<Organization> {
    this.logger.log(`Fetching organization: ${name}`);

    const organization = await this.organizationRepository.findByName(name);

    if (!organization) {
      throw new NotFoundException(`Organization with name '${name}' not found`);
    }

    return organization;
  }

  async findByEnterpriseId(enterpriseId: string): Promise<Organization[]> {
    this.logger.log(`Fetching organizations for enterprise: ${enterpriseId}`);

    await this.enterpriseService.findOneById(enterpriseId);

    return this.organizationRepository.findByEnterpriseId(enterpriseId);
  }

  async update(
    id: string,
    updateOrganizationDto: UpdateOrganizationDto,
  ): Promise<Organization> {
    this.logger.log(`Updating organization: ${id}`);

    await this.findOne(id);

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

  async remove(id: string): Promise<void> {
    this.logger.log(`Deleting organization: ${id}`);

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
