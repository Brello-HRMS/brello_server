import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { OrganizationProfileRepository } from '../repositories/organization-profile.repository';
import { CreateOrganizationProfileDto } from '../dto/create-organization-profile.dto';
import { UpdateOrganizationProfileDto } from '../dto/update-organization-profile.dto';
import { OrganizationProfile } from '../entities/organization-profile.entity';
import { OrganizationService } from './organization.service';
import { EnterpriseService } from '../../enterprise/services/enterprise.service';
import { DocumentService } from '../../document/services/document.service';
import { IndustryTypeService } from '../../industry-type/services/industry-type.service';
import { LoggedInUser } from '../../auth/interfaces/logged-in-user.interface';

@Injectable()
export class OrganizationProfileService {
  private readonly logger = new Logger(OrganizationProfileService.name);

  constructor(
    private readonly profileRepository: OrganizationProfileRepository,
    private readonly organizationService: OrganizationService,
    private readonly enterpriseService: EnterpriseService,
    @Inject(forwardRef(() => DocumentService))
    private readonly documentService: DocumentService,
    private readonly industryTypeService: IndustryTypeService,
  ) {}

  async create(
    createDto: CreateOrganizationProfileDto,
    user?: LoggedInUser,
  ): Promise<OrganizationProfile> {
    this.logger.log(
      `Creating organization profile for org: ${createDto.organization_id}`,
    );

    // Check if organization exists
    await this.organizationService.findOne(createDto.organization_id, user);

    // Check if enterprise exists
    await this.enterpriseService.findOneById(createDto.enterprise_id, user);

    // Check if logo exists (if provided)
    if (createDto.logo_id) {
      await this.documentService.findOne(createDto.logo_id, user as any);
    }

    // Check if industry type exists (if provided)
    if (createDto.industry_type_id) {
      await this.industryTypeService.findOne(createDto.industry_type_id, user);
    }

    // Check if parent organization exists (if provided)
    if (createDto.parent_id) {
      await this.organizationService.findOne(createDto.parent_id, user);
    }

    // Check for unique email
    const existingEmail = await this.profileRepository.findByEmail(
      createDto.email,
    );
    if (existingEmail) {
      throw new ConflictException(
        `Organization profile with email '${createDto.email}' already exists`,
      );
    }

    // Map DTO to Entity relations
    const profileData: Partial<OrganizationProfile> = {
      name: createDto.name,
      email: createDto.email,
      phone: createDto.phone,
      domain: createDto.domain,
      registration_no: createDto.registration_no,
      organization: { id: createDto.organization_id } as any,
      enterprise: { id: createDto.enterprise_id } as any,
    };

    if (createDto.logo_id) profileData.logo = { id: createDto.logo_id } as any;
    if (createDto.industry_type_id)
      profileData.industry_type = { id: createDto.industry_type_id } as any;
    if (createDto.parent_id)
      profileData.parent = { id: createDto.parent_id } as any;

    const profile = await this.profileRepository.create(profileData);
    this.logger.log(`Organization profile created successfully: ${profile.id}`);
    return this.profileRepository.findById(
      profile.id,
    ) as Promise<OrganizationProfile>;
  }

  async findOne(id: string, user?: LoggedInUser): Promise<OrganizationProfile> {
    this.logger.log(`Fetching organization profile: ${id}`);
    const profile = await this.profileRepository.findById(id);

    if (!profile) {
      throw new NotFoundException(
        `Organization profile with ID '${id}' not found`,
      );
    }
    return profile;
  }

  async findByOrganizationId(
    organizationId: string,
    user?: LoggedInUser,
  ): Promise<OrganizationProfile> {
    this.logger.log(`Fetching profile for organization: ${organizationId}`);
    const profile =
      await this.profileRepository.findByOrganizationId(organizationId);

    if (!profile) {
      throw new NotFoundException(
        `Profile for organization ID '${organizationId}' not found`,
      );
    }
    return profile;
  }

  async update(
    id: string,
    updateDto: UpdateOrganizationProfileDto,
    user?: LoggedInUser,
  ): Promise<OrganizationProfile> {
    this.logger.log(`Updating organization profile: ${id}`);

    const existingProfile = await this.findOne(id, user);

    // If email is updated, check uniqueness
    if (updateDto.email && updateDto.email !== existingProfile.email) {
      const emailConflict = await this.profileRepository.findByEmail(
        updateDto.email,
      );
      if (emailConflict && emailConflict.id !== id) {
        throw new ConflictException(
          `Organization profile with email '${updateDto.email}' already exists`,
        );
      }
    }

    // Validate related entities if they are being updated
    if (updateDto.logo_id)
      await this.documentService.findOne(updateDto.logo_id, user as any);
    if (updateDto.industry_type_id)
      await this.industryTypeService.findOne(updateDto.industry_type_id, user);
    if (updateDto.parent_id)
      await this.organizationService.findOne(updateDto.parent_id, user);

    // We don't typically allow moving an existing profile to a different organization/enterprise without complex rules,
    // but if the DTO provides them, we validate them.
    if (updateDto.organization_id)
      await this.organizationService.findOne(updateDto.organization_id, user);
    if (updateDto.enterprise_id)
      await this.enterpriseService.findOneById(updateDto.enterprise_id, user);

    // Map fields
    const updateData: Partial<OrganizationProfile> = {
      name: updateDto.name,
      email: updateDto.email,
      phone: updateDto.phone,
      domain: updateDto.domain,
      registration_no: updateDto.registration_no,
    };

    if (updateDto.organization_id)
      updateData.organization = { id: updateDto.organization_id } as any;
    if (updateDto.enterprise_id)
      updateData.enterprise = { id: updateDto.enterprise_id } as any;
    if (updateDto.logo_id !== undefined)
      updateData.logo = updateDto.logo_id
        ? ({ id: updateDto.logo_id } as any)
        : null;
    if (updateDto.industry_type_id !== undefined)
      updateData.industry_type = updateDto.industry_type_id
        ? ({ id: updateDto.industry_type_id } as any)
        : null;
    if (updateDto.parent_id !== undefined)
      updateData.parent = updateDto.parent_id
        ? ({ id: updateDto.parent_id } as any)
        : null;

    // Clean up undefined properties
    Object.keys(updateData).forEach(
      (key) =>
        updateData[key as keyof typeof updateData] === undefined &&
        delete updateData[key as keyof typeof updateData],
    );

    const updated = await this.profileRepository.update(id, updateData);
    if (!updated) {
      throw new NotFoundException(
        `Organization profile with ID '${id}' not found after update`,
      );
    }

    return updated;
  }

  async remove(id: string, user?: LoggedInUser): Promise<void> {
    this.logger.log(`Soft deleting organization profile: ${id}`);

    await this.findOne(id, user);

    const deleted = await this.profileRepository.softDelete(id);
    if (!deleted) {
      throw new NotFoundException(
        `Failed to delete organization profile with ID '${id}'`,
      );
    }

    this.logger.log(`Organization profile soft deleted successfully: ${id}`);
  }
}
