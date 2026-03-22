import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { OrganizationRepository } from '../repositories/organization.repository';
import { EnterpriseService } from '../../enterprise/services/enterprise.service';
import { UpdateOrganizationDto } from '../dto/update-organization.dto';
import { Organization } from '../entities/organization.entity';
import { SetupCompanyDto } from '../dto/setup-company.dto';
import { DataSource, IsNull } from 'typeorm';
import { UserRoleMap } from '../../rbac/entities/user-role-map.entity';
import {
  OrganizationSubscription,
  SubscriptionStatus,
} from '../../plan/entities/organization-subscription.entity';
import { PlanApp } from '../../plan/entities/plan-app.entity';
import { UserRepository } from 'src/modules/user/repositories/user.repository';
import { OrganizationProfileRepository } from '../repositories/organization-profile.repository';
import { OrganizationProfile } from '../entities/organization-profile.entity';
import { Status } from 'src/common/enums';
import { AppModule } from '../../app-module/entities/app-module.entity';
import { ModuleAccess } from '../../app-module/entities/module-access.entity';
import { Role } from 'src/modules/role/entities/role.entity';
import { App } from 'src/modules/app/entities/app.entity';
import { AuthService } from 'src/modules/auth/services/auth.service';
import { AuthResponseDto } from 'src/modules/auth/dto/auth-response.dto';
import { LoggedInUser } from '../../auth/interfaces/logged-in-user.interface';

@Injectable()
export class OrganizationService {
  private readonly logger = new Logger(OrganizationService.name);

  constructor(
    private readonly organizationRepository: OrganizationRepository,
    private readonly enterpriseService: EnterpriseService,
    private readonly dataSource: DataSource,
    private readonly userRepository: UserRepository,
    @Inject(forwardRef(() => AuthService))
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

      // Step 3: Find apps for the user's plan
      const planApps = await manager.find(PlanApp, {
        where: { plan_id: user.plan_id },
      });
      const planAppIds = planApps.map((pa) => pa.app_id);

      // Step 4: Clone platform default roles and permissions for those apps
      const finalRolesToAssign: Role[] = [];
      const platformRoles = await manager.find(Role, {
        where: { 
          is_system_role: true, 
          is_default: true,
          status: Status.ACTIVE,
          organization_id: IsNull(),
        },
      });

      for (const appId of planAppIds) {
        const platformRole = platformRoles.find(r => r.app_id === appId);

        if (platformRole) {
          // Clone the role for the organization
          const orgRole = manager.create(Role, {
            name: platformRole.name,
            app_id: appId,
            organization_id: savedOrg.id,
            is_system_role: false,
            is_default: false,
            status: Status.ACTIVE,
            description: `Cloned from platform default ${platformRole.name} role`,
          });
          const savedRole = await manager.save(orgRole);
          finalRolesToAssign.push(savedRole);

          // Clone permissions (ModuleAccess)
          const platformPermissions = await manager.find(ModuleAccess, {
            where: { role_id: platformRole.id },
          });

          for (const perm of platformPermissions) {
            const orgPerm = manager.create(ModuleAccess, {
              role_id: savedRole.id,
              module_id: perm.module_id,
              action_id: perm.action_id,
              access_flag: perm.access_flag,
            });
            await manager.save(orgPerm);
          }
        }
      }

      if (finalRolesToAssign.length === 0) {
        throw new NotFoundException(
          'No suitable platform default roles found to clone for the plan applications. Setup incomplete.',
        );
      }

      // Step 5: Create UserRoleMaps for each cloned role
      for (const role of finalRolesToAssign) {
        const urm = manager.create(UserRoleMap, {
          user_id: user.id,
          role_id: role.id,
          organization_id: savedOrg.id,
        });
        await manager.save(urm);
      }

      // Step 5: Update User
      user.organization_id = savedOrg.id;
      user.enterprise_id = savedOrg.enterprise_id;
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

  async findAll(user?: LoggedInUser): Promise<Organization[]> {
    this.logger.log('Fetching all organizations');
    return this.organizationRepository.findAll();
  }

  async findOne(id: string, user?: LoggedInUser): Promise<Organization> {
    this.logger.log(`Fetching organization: ${id}`);

    const organization = await this.organizationRepository.findById(id);

    if (!organization) {
      throw new NotFoundException(`Organization with ID '${id}' not found`);
    }

    return organization;
  }

  async findByName(name: string, user?: LoggedInUser): Promise<Organization> {
    this.logger.log(`Fetching organization: ${name}`);

    const organization = await this.organizationRepository.findByName(name);

    if (!organization) {
      throw new NotFoundException(`Organization with name '${name}' not found`);
    }

    return organization;
  }

  async findByEnterpriseId(enterpriseId: string, user?: LoggedInUser): Promise<Organization[]> {
    this.logger.log(`Fetching organizations for enterprise: ${enterpriseId}`);

    await this.enterpriseService.findOneById(enterpriseId, user);

    return this.organizationRepository.findByEnterpriseId(enterpriseId);
  }

  async update(
    id: string,
    updateOrganizationDto: UpdateOrganizationDto,
    user?: LoggedInUser,
  ): Promise<Organization> {
    this.logger.log(`Updating organization: ${id}`);

    await this.findOne(id, user);

    if (updateOrganizationDto.enterprise_id) {
      await this.enterpriseService.findOneById(
        updateOrganizationDto.enterprise_id,
        user,
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

  async remove(id: string, user?: LoggedInUser): Promise<void> {
    this.logger.log(`Deleting organization: ${id}`);

    await this.findOne(id, user);

    const deleted = await this.organizationRepository.delete(id);

    if (!deleted) {
      throw new NotFoundException(
        `Failed to delete organization with ID '${id}'`,
      );
    }

    this.logger.log(`Organization deleted successfully: ${id}`);
  }
}
