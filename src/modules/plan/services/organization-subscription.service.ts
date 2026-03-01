import { Injectable, BadRequestException } from '@nestjs/common';
import { OrganizationSubscription } from '../entities/organization-subscription.entity';
import { OrganizationSubscriptionRepository } from '../repositories/organization-subscription.repository';
import {
  CreateOrganizationSubscriptionDto,
  UpdateOrganizationSubscriptionDto,
} from '../dto/organization-subscription.dto';

@Injectable()
export class OrganizationSubscriptionService {
  constructor(
    private readonly orgSubRepository: OrganizationSubscriptionRepository,
  ) {}

  async create(
    dto: CreateOrganizationSubscriptionDto,
  ): Promise<OrganizationSubscription> {
    // Business Rule: An organization cannot have two ACTIVE subscriptions at once.
    // This is a naive check; real logic might upgrade/cancel the existing one first.
    const existingActive = await this.orgSubRepository.findActiveByOrganization(
      dto.organization_id,
    );

    if (existingActive && dto.status === 'Active') {
      throw new BadRequestException(
        'Organization Already has an Active Subscription. Please Cancel or Expire it first.',
      );
    }

    const subscription = this.orgSubRepository.create({
      ...dto,
      start_date: new Date(dto.start_date),
      end_date: dto.end_date ? new Date(dto.end_date) : undefined,
    });
    return this.orgSubRepository.save(subscription);
  }

  async findAll(): Promise<OrganizationSubscription[]> {
    return this.orgSubRepository.findAll();
  }

  async findOne(id: string): Promise<OrganizationSubscription> {
    return this.orgSubRepository.findOneById(id);
  }

  async update(
    id: string,
    dto: UpdateOrganizationSubscriptionDto,
  ): Promise<OrganizationSubscription> {
    const subscription = await this.findOne(id);

    if (dto.end_date) {
      subscription.end_date = new Date(dto.end_date);
    }
    if (dto.status) {
      subscription.status = dto.status;
    }

    return this.orgSubRepository.save(subscription);
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.orgSubRepository.softDelete(id);
  }
}
