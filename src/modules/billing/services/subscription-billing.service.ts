import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrganizationSubscriptionRepository } from '../../plan/repositories/organization-subscription.repository';
import { PlanRepository } from '../../plan/repositories/plan.repository';
import { Plan, BillingCycle } from '../../plan/entities/plan.entity';
import {
  OrganizationSubscription,
  SubscriptionStatus,
} from '../../plan/entities/organization-subscription.entity';
import { InvoiceService } from './invoice.service';
import { Invoice } from '../entities/invoice.entity';
import { Status } from 'src/common/enums';

export type ChangeApplied = 'immediate' | 'next_cycle';

export interface ChangePlanResult {
  subscription: OrganizationSubscription;
  invoice: Invoice | null;
  applied: ChangeApplied;
}

@Injectable()
export class SubscriptionBillingService {
  constructor(
    @InjectRepository(OrganizationSubscription)
    private readonly subOrm: Repository<OrganizationSubscription>,
    private readonly subRepo: OrganizationSubscriptionRepository,
    private readonly planRepo: PlanRepository,
    private readonly invoiceService: InvoiceService,
  ) {}

  async getActiveForOrg(organizationId: string): Promise<OrganizationSubscription | null> {
    return this.subRepo.findActiveByOrganization(organizationId);
  }

  async changePlan(args: {
    organizationId: string;
    enterpriseId: string | null;
    newPlanId: string;
    newCycle: BillingCycle;
  }): Promise<ChangePlanResult> {
    const current = await this.subRepo.findActiveByOrganization(args.organizationId);
    if (!current) {
      throw new NotFoundException('No active subscription to change');
    }
    const newPlan = await this.planRepo.findOneById(args.newPlanId);
    if (!newPlan) throw new NotFoundException('Plan not found');
    const currentPlan = await this.planRepo.findOneById(current.plan_id);
    if (!currentPlan) throw new NotFoundException('Current plan not found');

    const sameTier = newPlan.tier_rank === currentPlan.tier_rank;
    const sameCycle = args.newCycle === current.billing_cycle;
    if (sameTier && sameCycle) {
      throw new BadRequestException(
        'Already on this plan and billing cycle',
      );
    }

    const isTierUpgrade = newPlan.tier_rank > currentPlan.tier_rank;
    const isCycleUpgrade =
      sameTier &&
      args.newCycle === BillingCycle.ANNUAL &&
      current.billing_cycle === BillingCycle.MONTHLY;
    const isImmediate = isTierUpgrade || isCycleUpgrade || current.is_trial;

    if (!isImmediate) {
      // Downgrade (tier-down or cycle-down) — defer to next renewal.
      current.pending_plan_id = newPlan.id;
      current.pending_billing_cycle = args.newCycle;
      await this.subOrm.save(current);
      return { subscription: current, invoice: null, applied: 'next_cycle' };
    }

    // Immediate path: close current sub and start a fresh one on the new plan.
    const now = new Date();
    current.sub_status = SubscriptionStatus.CANCELLED;
    current.end_date = now;
    await this.subOrm.save(current);

    const periodStart = now;
    const periodEnd = addCycle(periodStart, args.newCycle);
    const fresh = this.subOrm.create({
      organization_id: args.organizationId,
      enterprise_id: args.enterpriseId ?? undefined,
      plan_id: newPlan.id,
      billing_cycle: args.newCycle,
      is_trial: false,
      sub_status: SubscriptionStatus.ACTIVE,
      start_date: periodStart,
      end_date: periodEnd,
      next_renewal_date: periodEnd,
      status: Status.ACTIVE,
    } as Partial<OrganizationSubscription>);
    const savedSub = (await this.subOrm.save(fresh)) as OrganizationSubscription;

    const invoice = await this.invoiceService.generate({
      subscription: savedSub,
      plan: newPlan,
      billingCycle: args.newCycle,
      organizationId: args.organizationId,
      enterpriseId: args.enterpriseId,
      periodStart,
      periodEnd,
    });

    return { subscription: savedSub, invoice, applied: 'immediate' };
  }

  async cancelPendingChange(organizationId: string): Promise<OrganizationSubscription> {
    const current = await this.subRepo.findActiveByOrganization(organizationId);
    if (!current) throw new NotFoundException('No active subscription');
    if (!current.pending_plan_id && !current.pending_billing_cycle) {
      throw new BadRequestException('No pending change to cancel');
    }
    current.pending_plan_id = null;
    current.pending_billing_cycle = null;
    return this.subOrm.save(current);
  }

  async cancelSubscription(organizationId: string): Promise<OrganizationSubscription> {
    const current = await this.subRepo.findActiveByOrganization(organizationId);
    if (!current) throw new NotFoundException('No active subscription');
    current.sub_status = SubscriptionStatus.CANCELLED;
    current.end_date = new Date();
    return this.subOrm.save(current);
  }
}

function addCycle(base: Date, cycle: BillingCycle): Date {
  const d = new Date(base);
  if (cycle === BillingCycle.ANNUAL) {
    d.setFullYear(d.getFullYear() + 1);
  } else {
    d.setMonth(d.getMonth() + 1);
  }
  return d;
}
