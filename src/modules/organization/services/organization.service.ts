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
import { Document } from '../../document/entities/document.entity';
import { FolderType } from '../../document/enums/document.enum';
import { DocumentService } from '../../document/services/document.service';
import { DataSource, IsNull, Not, EntityManager } from 'typeorm';
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
    @Inject(forwardRef(() => DocumentService))
    private readonly documentService: DocumentService,
  ) {}

  async setupCompany(
    dto: SetupCompanyDto,
    logo?: any,
  ): Promise<AuthResponseDto> {
    const userId = dto.user_id;

    // 1. Validate prerequisites and early checks
    const user = await this.validateSetupPrerequisites(dto);

    this.logger.log(`Starting company setup for user: ${userId}`);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const manager = queryRunner.manager;

      // 2. Execute setup steps in transaction
      const enterpriseId = await this.createOrLinkEnterprise(
        manager,
        dto,
        user,
      );
      const savedOrg = await this.createOrganization(
        manager,
        dto,
        enterpriseId,
      );

      const profile = await this.createOrganizationProfile(
        manager,
        savedOrg,
        dto,
        user,
        enterpriseId,
        undefined, // Logo ID will be updated after upload
      );
      await this.setupOrganizationRolesAndPermissions(
        manager,
        user.plan_id,
        savedOrg.id,
        user.id,
      );
      await this.updateUserAssociation(
        manager,
        user,
        savedOrg.id,
        enterpriseId,
      );
      await this.createOrganizationSubscription(
        manager,
        savedOrg.id,
        user.plan_id,
      );
      await this.createDefaultPayrollComponents(
        manager,
        savedOrg.id,
        enterpriseId,
      );

      await queryRunner.commitTransaction();
      this.logger.log(
        `Company setup completed successfully for org: ${savedOrg.id}`,
      );

      // Handle logo upload AFTER transaction commit to avoid uncommitted read isolation errors
      if (logo) {
        try {
          const logoDocument = await this.handleLogoUpload(
            user,
            savedOrg.id,
            enterpriseId,
            logo,
          );
          
          if (logoDocument) {
            await this.dataSource.manager.update(
              'OrganizationProfile',
              profile.id,
              { logo_id: logoDocument.id }
            );
          }
        } catch (logoError: any) {
          this.logger.warn(`Failed to upload company logo, but setup succeeded: ${logoError.message}`);
        }
      }

      return this.authService.buildAuthResponse(user);
    } catch (error: any) {
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

  // --- Private Helper Methods for Setup Company ---

  private async validateSetupPrerequisites(
    dto: SetupCompanyDto,
  ): Promise<User> {
    const user = await this.userRepository.findById(dto.user_id);

    if (!user) {
      throw new NotFoundException(`User with ID ${dto.user_id} not found`);
    }

    if (user.organization_id) {
      throw new BadRequestException('User already has an organization setup');
    }

    if (!user.plan_id) {
      this.logger.warn(`User ${user.id} has no plan assigned.`);
      throw new BadRequestException('User does not have a plan assigned');
    }

    await this.planService.findOne(user.plan_id);

    if (dto.subdomain) {
      const existingOrgBySubdomain =
        await this.organizationRepository.findBySubdomain(dto.subdomain);
      if (existingOrgBySubdomain.length > 0) {
        throw new BadRequestException('Subdomain is already taken');
      }
    }

    const existingOrgByWebsite =
      await this.organizationRepository.findByWebsiteUrl(dto.website_url);
    if (existingOrgByWebsite.length > 0) {
      throw new BadRequestException('Website URL is already taken');
    }

    const existingOrgByName = await this.organizationRepository.findByName(
      dto.name,
    );
    if (existingOrgByName) {
      throw new BadRequestException('Organization name is already taken');
    }

    // Check if OrganizationProfile already exists for this email or phone
    const existingProfileByEmail = await this.dataSource.manager.findOne(
      'OrganizationProfile',
      {
        where: { email: user.email },
      },
    );
    if (existingProfileByEmail) {
      throw new BadRequestException(
        'An organization profile with this email already exists.',
      );
    }

    const existingProfileByPhone = await this.dataSource.manager.findOne(
      'OrganizationProfile',
      {
        where: { phone: user.phone },
      },
    );
    if (existingProfileByPhone) {
      throw new BadRequestException(
        'An organization profile with this phone number already exists.',
      );
    }

    return user;
  }

  private async createOrLinkEnterprise(
    manager: EntityManager,
    dto: SetupCompanyDto,
    user: User,
  ): Promise<string> {
    if (user.enterprise_id) {
      return user.enterprise_id;
    }

    const newEnterpriseContent = manager.create(Enterprise, {
      name: dto.name,
      domain: dto.subdomain || dto.website_url, // Use website_url if subdomain missing
      status: Status.ACTIVE,
    });
    const savedEnterprise = await manager.save(newEnterpriseContent);
    return savedEnterprise.id;
  }

  private async createOrganization(
    manager: EntityManager,
    dto: SetupCompanyDto,
    enterpriseId: string,
  ): Promise<Organization> {
    const newOrgObject = manager.create(Organization, {
      name: dto.name,
      subdomain: dto.subdomain || undefined,
      website_url: dto.website_url,
      enterprise_id: enterpriseId,
    });
    return manager.save(newOrgObject);
  }

  private async handleLogoUpload(
    user: User,
    orgId: string,
    enterpriseId: string,
    logo?: any,
  ): Promise<Document | null> {
    if (!logo) return null;

    const mockUser: LoggedInUser = {
      userId: user.id,
      email: user.email,
      enterpriseId: enterpriseId,
      organizationId: orgId,
      roles: [],
    } as any;

    return this.documentService.uploadDocument(
      mockUser,
      {
        buffer: logo.buffer,
        originalname: logo.originalname,
        mimetype: logo.mimetype,
        size: logo.size,
      },
      FolderType.ORGANIZATION_LOGO,
    );
  }

  private async createOrganizationProfile(
    manager: EntityManager,
    org: Organization,
    dto: SetupCompanyDto,
    user: User,
    enterpriseId: string,
    logoId?: string,
  ): Promise<OrganizationProfile> {
    const profile = manager.create(OrganizationProfile, {
      organization: org,
      name: dto.name,
      email: user.email,
      phone: user.phone,
      industry_type_id: dto.business_type_id,
      enterprise_id: enterpriseId,
      logo_id: logoId,
    });
    return manager.save(profile);
  }

  private async setupOrganizationRolesAndPermissions(
    manager: EntityManager,
    planId: string,
    orgId: string,
    userId: string,
  ): Promise<void> {
    const planApps = await manager.find(PlanApp, {
      where: { plan_id: planId },
    });
    const planAppIds = planApps.map((pa) => pa.app_id);

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
          organization_id: orgId,
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

    // Create UserRoleMaps for each cloned role
    for (const role of finalRolesToAssign) {
      const urm = manager.create(UserRoleMap, {
        user_id: userId,
        role_id: role.id,
        organization_id: orgId,
      });
      await manager.save(urm);
    }
  }

  private async updateUserAssociation(
    manager: EntityManager,
    user: User,
    orgId: string,
    enterpriseId: string,
  ): Promise<void> {
    user.organization_id = orgId;
    user.enterprise_id = enterpriseId;
    await manager.save(user);
  }

  private async createOrganizationSubscription(
    manager: EntityManager,
    orgId: string,
    planId: string,
  ): Promise<void> {
    const subscription = manager.create(OrganizationSubscription, {
      organization_id: orgId,
      plan_id: planId,
      sub_status: SubscriptionStatus.ACTIVE,
      start_date: new Date(),
    });

    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + 14); // 14 days trial
    subscription.end_date = trialEndDate;
    await manager.save(subscription);
  }

  private async createDefaultPayrollComponents(
    manager: EntityManager,
    orgId: string,
    enterpriseId: string,
  ): Promise<void> {
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
      organization_id: orgId,
    });
    await manager.save(basicComponent);
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
