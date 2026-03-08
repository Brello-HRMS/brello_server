import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not } from 'typeorm';
import { OrganizationProfile } from '../entities/organization-profile.entity';
import { Status } from '../../../common/enums';

@Injectable()
export class OrganizationProfileRepository {
  constructor(
    @InjectRepository(OrganizationProfile)
    private readonly repository: Repository<OrganizationProfile>,
  ) {}

  async create(
    profileData: Partial<OrganizationProfile>,
  ): Promise<OrganizationProfile> {
    const newProfile = this.repository.create(profileData);
    return this.repository.save(newProfile);
  }

  async findById(id: string): Promise<OrganizationProfile | null> {
    return this.repository.findOne({
      where: { id, status: Not(Status.DELETED) },
      relations: [
        'organization',
        'enterprise',
        'logo',
        'industry_type',
        'parent',
      ],
    });
  }

  async findByOrganizationId(
    organizationId: string,
  ): Promise<OrganizationProfile | null> {
    return this.repository.findOne({
      where: {
        organization: { id: organizationId },
        status: Not(Status.DELETED),
      },
      relations: [
        'organization',
        'enterprise',
        'logo',
        'industry_type',
        'parent',
      ],
    });
  }

  async findByEmail(email: string): Promise<OrganizationProfile | null> {
    return this.repository.findOne({
      where: { email, status: Not(Status.DELETED) },
    });
  }

  async update(
    id: string,
    updateData: Partial<OrganizationProfile>,
  ): Promise<OrganizationProfile | null> {
    await this.repository.update(id, updateData);
    return this.findById(id);
  }

  async softDelete(id: string): Promise<boolean> {
    const result = await this.repository.update(id, {
      status: Status.DELETED,
    });
    return (result.affected ?? 0) > 0;
  }
}
