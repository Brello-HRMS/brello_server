import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import {
  OrganizationSubscription,
  SubscriptionStatus,
} from '../entities/organization-subscription.entity';
import { Status } from 'src/common/enums';

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
      where: { status: 'ACTIVE' as any },
    });
  }

  async findOneById(id: string): Promise<OrganizationSubscription> {
    const subscription = await this.repository.findOne({
      where: { id, status: 'ACTIVE' as any },
      relations: ['plan'],
    });
    if (!subscription) {
      throw new NotFoundException(
        `OrganizationSubscription with ID "${id}" not found`,
      );
    }
    return subscription;
  }

  // Returns the org's currently-effective subscription row.
  // Excludes terminal CANCELLED rows (an upgrade closes the old sub and creates a new one,
  // so multiple rows can coexist — newest wins). EXPIRED rows are kept so the
  // ActiveSubscriptionGuard can detect them and block.
  async findActiveByOrganization(
    organizationId: string,
  ): Promise<OrganizationSubscription | null> {
    return this.repository.findOne({
      where: {
        organization_id: organizationId,
        status: Status.ACTIVE,
        sub_status: Not(SubscriptionStatus.CANCELLED),
      },
      relations: ['plan'],
      order: { created_at: 'DESC' },
    });
  }

  async findByOrganizationId(
    organizationId: string,
  ): Promise<OrganizationSubscription[]> {
    return this.repository.find({
      where: { organization_id: organizationId },
      relations: ['plan'],
      order: { created_at: 'DESC' },
    });
  }

  async softDelete(id: string): Promise<boolean> {
    const result = await this.repository.update(id, {
      status: 'DELETED' as any,
    });
    return (result.affected ?? 0) > 0;
  }
}
