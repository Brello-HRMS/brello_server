import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Organization } from '../entities/organization.entity';

@Injectable()
export class OrganizationRepository {
  constructor(
    @InjectRepository(Organization)
    private readonly repository: Repository<Organization>,
  ) {}

  async create(organization: Partial<Organization>): Promise<Organization> {
    const newOrganization = this.repository.create(organization);
    return this.repository.save(newOrganization);
  }

  async findAll(): Promise<Organization[]> {
    return this.repository.find({
      relations: ['enterprise'],
      order: { created_at: 'DESC' },
    });
  }

  async findById(id: string): Promise<Organization | null> {
    return this.repository.findOne({
      where: { id },
      relations: ['enterprise'],
    });
  }

  async findByEnterpriseId(enterpriseId: string): Promise<Organization[]> {
    return this.repository.find({
      where: { enterprise_id: enterpriseId },
      relations: ['enterprise'],
      order: { created_at: 'DESC' },
    });
  }

  async findBySubdomain(subdomain: string): Promise<Organization[]> {
    return this.repository.find({
      where: { subdomain },
      order: { created_at: 'DESC' },
    });
  }

  async findByWebsiteUrl(websiteUrl: string): Promise<Organization[]> {
    return this.repository.find({
      where: { website_url: websiteUrl },
      order: { created_at: 'DESC' },
    });
  }

  async findByName(name: string): Promise<Organization | null> {
    return this.repository.findOne({
      where: { name },
      order: { created_at: 'DESC' },
    });
  }

  async update(
    id: string,
    updateData: Partial<Organization>,
  ): Promise<Organization | null> {
    await this.repository.update(id, updateData);
    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.repository.delete(id);
    return (result.affected ?? 0) > 0;
  }
  async exists(id: string): Promise<boolean> {
    const count = await this.repository.count({ where: { id } });
    return count > 0;
  }
  async countByEnterpriseId(enterpriseId: string): Promise<number> {
    return this.repository.count({ where: { enterprise_id: enterpriseId } });
  }
}
