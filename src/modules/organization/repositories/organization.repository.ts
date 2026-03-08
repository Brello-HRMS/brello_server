import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Organization } from '../entities/organization.entity';

// Organization Repository - Implements the Repository Pattern to encapsulate data access logic
@Injectable()
export class OrganizationRepository {
  constructor(
    @InjectRepository(Organization)
    private readonly repository: Repository<Organization>,
  ) {}

  // Create a new organization
  async create(organization: Partial<Organization>): Promise<Organization> {
    const newOrganization = this.repository.create(organization);
    return this.repository.save(newOrganization);
  }

  // Find all organizations
  async findAll(): Promise<Organization[]> {
    return this.repository.find({
      relations: ['enterprise'],
      order: { created_at: 'DESC' },
    });
  }

  // Find organization by ID
  async findById(id: string): Promise<Organization | null> {
    return this.repository.findOne({
      where: { id },
      relations: ['enterprise'],
    });
  }

  // Find organizations by enterprise ID
  async findByEnterpriseId(enterpriseId: string): Promise<Organization[]> {
    return this.repository.find({
      where: { enterprise_id: enterpriseId },
      relations: ['enterprise'],
      order: { created_at: 'DESC' },
    });
  }

  // Find organization by subdomain
  async findBySubdomain(subdomain: string): Promise<Organization[]> {
    return this.repository.find({
      where: { subdomain },
      order: { created_at: 'DESC' },
    });
  }

  // Update an organization
  async update(
    id: string,
    updateData: Partial<Organization>,
  ): Promise<Organization | null> {
    await this.repository.update(id, updateData);
    return this.findById(id);
  }

  // Delete an organization
  async delete(id: string): Promise<boolean> {
    const result = await this.repository.delete(id);
    return (result.affected ?? 0) > 0;
  }

  // Check if organization exists by ID
  async exists(id: string): Promise<boolean> {
    const count = await this.repository.count({ where: { id } });
    return count > 0;
  }

  // Count organizations by enterprise ID
  async countByEnterpriseId(enterpriseId: string): Promise<number> {
    return this.repository.count({ where: { enterprise_id: enterpriseId } });
  }
}
