import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrganizationSubscription } from '../entities/organization-subscription.entity';

@Injectable()
export class OrganizationSubscriptionRepository {
  constructor(
    @InjectRepository(OrganizationSubscription)
    private readonly repository: Repository<OrganizationSubscription>,
  ) {}

  create(data: Partial<OrganizationSubscription>): OrganizationSubscription {
    return this.repository.create(data);
  }

  async save(
    subscription: OrganizationSubscription,
  ): Promise<OrganizationSubscription> {
    return this.repository.save(subscription);
  }

  async findAll(): Promise<OrganizationSubscription[]> {
    return this.repository.find({
      relations: ['plan'],
      order: { created_at: 'DESC' },
      where: { base_status: 'ACTIVE' as any },
    });
  }

  async findOneById(id: string): Promise<OrganizationSubscription> {
    const subscription = await this.repository.findOne({
      where: { id, base_status: 'ACTIVE' as any },
      relations: ['plan'],
    });
    if (!subscription) {
      throw new NotFoundException(
        `OrganizationSubscription with ID "${id}" not found`,
      );
    }
    return subscription;
  }

  async findActiveByOrganization(
    organizationId: string,
  ): Promise<OrganizationSubscription | null> {
    return this.repository.findOne({
      where: {
        organization_id: organizationId,
        status: 'Active' as any, // Matches the enum capitalization
        base_status: 'ACTIVE' as any,
      },
      relations: ['plan'],
    });
  }

  async softDelete(id: string): Promise<boolean> {
    const result = await this.repository.update(id, {
      base_status: 'DELETED' as any,
    });
    return (result.affected ?? 0) > 0;
  }
}
