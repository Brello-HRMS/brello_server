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
import { Enterprise } from '../../enterprise/entities/enterprise.entity';
import { Organization } from '../entities/organization.entity';
import { SetupCompanyDto } from '../dto/setup-company.dto';
import { DataSource, IsNull, Not } from 'typeorm';
import { User } from 'src/modules/user/entities/user.entity';
import { UserProfile } from 'src/modules/user/entities/user-profile.entity';
import { UserRoleMap } from '../../rbac/entities/user-role-map.entity';
import {
  OrganizationSubscription,
  SubscriptionStatus,
} from '../../plan/entities/organization-subscription.entity';
import { PlanApp } from '../../plan/entities/plan-app.entity';
import { UserRepository } from 'src/modules/user/repositories/user.repository';
import { OrganizationProfile } from '../entities/organization-profile.entity';
import { Status } from 'src/common/enums';
import { AppModule } from '../../app-module/entities/app-module.entity';
import { ModuleAccess } from '../../app-module/entities/module-access.entity';
import { Role } from 'src/modules/role/entities/role.entity';
import { App } from 'src/modules/app/entities/app.entity';
import { AuthService } from 'src/modules/auth/services/auth.service';
import { AuthResponseDto } from 'src/modules/auth/dto/auth-response.dto';
import { PlanService } from 'src/modules/plan/services/plan.service';
import { LoggedInUser } from '../../auth/interfaces/logged-in-user.interface';
import { PayrollComponent } from '../../payroll/entities/payroll-component.entity';
import {
  ComponentType,
  ComponentCategory,
  CalculationType,
} from '../../payroll/enums/payroll.enum';

@Injectable()
export class OrganizationService {
  private readonly logger = new Logger(OrganizationService.name);

  constructor(
    private readonly organizationRepository: OrganizationRepository,
    private readonly enterpriseService: EnterpriseService,
    private readonly dataSource: DataSource,
    private readonly userRepository: UserRepository,
    private readonly planService: PlanService,
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

    await this.planService.findOne(user.plan_id);

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

      // Step 1: Create or Link Enterprise
      let enterpriseId = user.enterprise_id;
      if (!enterpriseId) {
        const newEnterpriseContent = manager.create(Enterprise, {
          name: dto.name,
          domain: dto.subdomain, // Use subdomain as temporary domain
          status: Status.ACTIVE,
        });
        const savedEnterprise = await manager.save(newEnterpriseContent);
        enterpriseId = savedEnterprise.id;
      }

      // Step 2: Create Organization
      const newOrgObject = manager.create(Organization, {
        name: dto.name,
        subdomain: dto.subdomain,
        enterprise_id: enterpriseId, // Set the enterprise_id
      });
      const savedOrg = await manager.save(newOrgObject);

      // Step 3: Create OrganizationProfile
      const profile = manager.create(OrganizationProfile, {
        organization: savedOrg,
        name: dto.name,
        email: user.email,
        phone: user.phone,
        industry_type_id: dto.business_type_id,
        enterprise_id: enterpriseId, // Set common field
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
        const platformRole = platformRoles.find((r) => r.app_id === appId);

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
      user.enterprise_id = enterpriseId; // Use the local enterpriseId
      await manager.save(user);

      // Step 6: Create OrganizationSubscription (14-day trial)
      const trialEndDate = new Date();
      trialEndDate.setDate(trialEndDate.getDate() + 14);
      const subscription = manager.create(OrganizationSubscription, {
        organization_id: savedOrg.id,
        plan_id: user.plan_id,
        sub_status: SubscriptionStatus.TRIAL,
        is_trial: true,
        start_date: new Date(),
        end_date: trialEndDate,
        next_renewal_date: trialEndDate,
      });
      await manager.save(subscription);

      // Step 7: Create Default Payroll Component (Basic Salary)
      const basicComponent = manager.create(PayrollComponent, {
        name: 'Basic Salary',
        component_type: ComponentType.EARNING,
        category: ComponentCategory.FIXED,
        calculation_type: CalculationType.PERCENTAGE,
        value: 50,
        is_taxable: true,
        is_default: true,
        is_editable: false,
        is_active: true,
        enterprise_id: enterpriseId,
        organization_id: savedOrg.id,
      });
      await manager.save(basicComponent);

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

  async findByEnterpriseId(
    enterpriseId: string,
    user?: LoggedInUser,
  ): Promise<Organization[]> {
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
  async debugUser(email: string): Promise<any> {
    const user = await this.userRepository.findByEmail(email);
    if (!user) return { error: 'User not found' };

    const org = user.organization_id
      ? await this.organizationRepository.findById(user.organization_id)
      : null;

    return {
      user: {
        id: user.id,
        email: user.email,
        enterprise_id: user.enterprise_id,
        organization_id: user.organization_id,
        is_platform_admin: user.is_platform_admin,
        status: user.status,
      },
      org: org
        ? {
            id: org.id,
            name: org.name,
            enterprise_id: org.enterprise_id,
          }
        : null,
    };
  }

  async repairEnterpriseIds(): Promise<any> {
    const logs: string[] = [];
    const addLog = (msg: string) => {
      this.logger.log(msg);
      logs.push(msg);
    };

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const manager = queryRunner.manager;

      // 1. Log specifically for b10@admin.com
      const targetUser = await manager.findOne(User, {
        where: { email: 'b10@admin.com' },
      });
      if (targetUser) {
        addLog(
          `Target User: ${targetUser.email}, EntID: ${targetUser.enterprise_id}, OrgID: ${targetUser.organization_id}`,
        );
        const targetOrg = await manager.findOne(Organization, {
          where: { id: targetUser.organization_id },
        });
        if (targetOrg) {
          addLog(
            `Target Org: ${targetOrg.name}, EntID: ${targetOrg.enterprise_id}`,
          );
        } else {
          addLog(
            `Target Org NOT FOUND for OrgID: ${targetUser.organization_id}`,
          );
        }
      } else {
        addLog(`Target User b10@admin.com NOT FOUND`);
      }

      // 2. Log all organizations for debugging
      const allOrgs = await manager.find(Organization);
      addLog(`Total organizations in DB: ${allOrgs.length}`);

      // 3. Find organizations missing enterprise_id
      const orgs = await manager.find(Organization, {
        where: { enterprise_id: IsNull() },
      });

      addLog(`Found ${orgs.length} organizations missing enterprise_id`);

      for (const org of orgs) {
        const enterprise = manager.create(Enterprise, {
          name: org.name,
          domain: org.subdomain || org.name.toLowerCase().replace(/ /g, '-'),
          status: Status.ACTIVE,
        });
        const savedEnterprise = await manager.save(enterprise);

        await manager.update(Organization, org.id, {
          enterprise_id: savedEnterprise.id,
        });

        await manager.update(
          User,
          { organization_id: org.id },
          { enterprise_id: savedEnterprise.id },
        );

        await manager.update(
          UserProfile,
          { organization_id: org.id },
          { enterprise_id: savedEnterprise.id },
        );

        addLog(`Linked Org ${org.name} to Enterprise ${savedEnterprise.id}`);
      }

      // 4. Find users missing enterprise_id but have organization_id
      const usersToSync = await manager.find(User, {
        where: {
          enterprise_id: IsNull(),
          organization_id: Not(IsNull()) as any,
        },
      });

      addLog(
        `Found ${usersToSync.length} users missing enterprise_id but have org_id`,
      );

      for (const u of usersToSync) {
        const org = await manager.findOne(Organization, {
          where: { id: u.organization_id },
        });
        if (org && org.enterprise_id) {
          await manager.update(User, u.id, {
            enterprise_id: org.enterprise_id,
          });
          if (u.user_profile_id) {
            await manager.update(UserProfile, u.user_profile_id, {
              enterprise_id: org.enterprise_id,
            });
          }
          addLog(`Synced User ${u.email} with Enterprise ${org.enterprise_id}`);
        }
      }

      await queryRunner.commitTransaction();
      return {
        success: true,
        logs,
        fixedOrgs: orgs.length,
        syncedUsers: usersToSync.length,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      addLog(`Repair failed: ${error.message}`);
      return { success: false, error: error.message, logs };
    } finally {
      await queryRunner.release();
    }
  }
}
