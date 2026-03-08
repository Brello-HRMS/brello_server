import { Injectable, BadRequestException } from '@nestjs/common';
import { OrganizationSubscription } from '../entities/organization-subscription.entity';
import { OrganizationSubscriptionRepository } from '../repositories/organization-subscription.repository';
import {
  CreateOrganizationSubscriptionDto,
  UpdateOrganizationSubscriptionDto,
} from '../dto/organization-subscription.dto';
import { OrganizationService } from '../../organization/services/organization.service';
import { EnterpriseService } from '../../enterprise/services/enterprise.service';
import { PlanAppRepository } from '../repositories/plan-app.repository';

@Injectable()
export class OrganizationSubscriptionService {
  constructor(
    private readonly orgSubRepository: OrganizationSubscriptionRepository,
    private readonly organizationService: OrganizationService,
    private readonly enterpriseService: EnterpriseService,
    private readonly planAppRepository: PlanAppRepository,
  ) {}

  async create(
    dto: CreateOrganizationSubscriptionDto,
  ): Promise<OrganizationSubscription> {
    // Business Rule: An organization cannot have two ACTIVE subscriptions at once.
    // This is a naive check; real logic might upgrade/cancel the existing one first.
    const existingActive = await this.orgSubRepository.findActiveByOrganization(
      dto.organization_id,
    );

    if (existingActive && dto.sub_status === 'Active') {
      throw new BadRequestException(
        'Organization Already has an Active Subscription. Please Cancel or Expire it first.',
      );
    }

    const subscription = this.orgSubRepository.create({
      ...dto,
      start_date: new Date(dto.start_date),
      end_date: dto.end_date ? new Date(dto.end_date) : undefined,
    });
    const savedSubscription = await this.orgSubRepository.save(subscription);

    // Business Logic: Assign Apps to Enterprise
    const organization = await this.organizationService.findOne(
      dto.organization_id,
    );
    const enterpriseId = organization.enterprise_id;

    if (enterpriseId) {
      const planApps = await this.planAppRepository.getAppsForPlan(dto.plan_id);
      const appIds = planApps.map((pa) => pa.app_id);

      if (appIds.length > 0) {
        await this.enterpriseService.assignAppsToEnterprise(
          enterpriseId,
          appIds,
        );
      }
    }

    return savedSubscription;
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
    if (dto.sub_status) {
      subscription.sub_status = dto.sub_status;
    }

    return this.orgSubRepository.save(subscription);
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.orgSubRepository.softDelete(id);
  }
}
