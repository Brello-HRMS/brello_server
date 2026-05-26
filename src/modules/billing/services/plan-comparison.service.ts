import { Injectable } from '@nestjs/common';
import { PlanRepository } from '../../plan/repositories/plan.repository';
import { OrganizationSubscriptionRepository } from '../../plan/repositories/organization-subscription.repository';
import { EmployeeCountService } from './employee-count.service';
import { GstCalculatorService } from './gst-calculator.service';
import { BillingCycle, Plan } from '../../plan/entities/plan.entity';

export interface PlanComparisonRow {
  id: string;
  name: string;
  tier_rank: number;
  description: string | null;
  feature: string[];
  price_per_employee_monthly: number;
  price_per_employee_annual: number;
  annual_discount_percent: number;
  estimated_total_monthly: {
    subtotal: number;
    gst_amount: number;
    total: number;
  };
  estimated_total_annual: {
    subtotal: number;
    gst_amount: number;
    total: number;
  };
  is_current: boolean;
  is_current_cycle: boolean;
  cta:
    | 'Current Plan'
    | 'Upgrade Now'
    | 'Downgrade Next Cycle'
    | 'Switch to Annual'
    | 'Switch to Monthly'
    | 'Choose Plan';
}

@Injectable()
export class PlanComparisonService {
  constructor(
    private readonly planRepo: PlanRepository,
    private readonly subRepo: OrganizationSubscriptionRepository,
    private readonly employeeCount: EmployeeCountService,
    private readonly gst: GstCalculatorService,
  ) {}

  async compare(args: {
    organizationId: string;
    cycle: BillingCycle;
  }): Promise<{ cycle: BillingCycle; plans: PlanComparisonRow[] }> {
    const [plans, currentSub, headcount] = await Promise.all([
      this.planRepo.findAll(),
      this.subRepo.findActiveByOrganization(args.organizationId),
      this.employeeCount.getActiveEmployeeCount(args.organizationId),
    ]);

    const currentPlan = currentSub
      ? plans.find((p) => p.id === currentSub.plan_id) ?? null
      : null;

    const rows = plans.map((p) =>
      this.buildRow(p, args.cycle, currentSub, currentPlan, headcount),
    );
    return { cycle: args.cycle, plans: rows };
  }

  private buildRow(
    plan: Plan,
    requestedCycle: BillingCycle,
    currentSub: { plan_id: string; billing_cycle: BillingCycle } | null,
    currentPlan: Plan | null,
    headcount: number,
  ): PlanComparisonRow {
    const monthlyUnit = Number(plan.price);
    const annualUnit = Number(plan.price_per_employee_annual);

    const monthlySubtotal = headcount * monthlyUnit;
    const annualSubtotal = headcount * annualUnit;
    const monthly = this.gst.compute(monthlySubtotal);
    const annual = this.gst.compute(annualSubtotal);

    const isCurrent = currentSub?.plan_id === plan.id;
    const isCurrentCycle =
      isCurrent && currentSub?.billing_cycle === requestedCycle;

    return {
      id: plan.id,
      name: plan.name,
      tier_rank: plan.tier_rank,
      description: plan.description,
      feature: plan.feature,
      price_per_employee_monthly: monthlyUnit,
      price_per_employee_annual: annualUnit,
      annual_discount_percent: Number(plan.annual_discount_percent),
      estimated_total_monthly: {
        subtotal: monthly.subtotal,
        gst_amount: monthly.gst_amount,
        total: monthly.total,
      },
      estimated_total_annual: {
        subtotal: annual.subtotal,
        gst_amount: annual.gst_amount,
        total: annual.total,
      },
      is_current: isCurrent,
      is_current_cycle: isCurrentCycle,
      cta: pickCta({
        isCurrent,
        isCurrentCycle,
        requestedCycle,
        targetPlanTier: plan.tier_rank,
        currentPlanTier: currentPlan?.tier_rank ?? null,
        currentCycle: currentSub?.billing_cycle ?? null,
      }),
    };
  }
}

function pickCta(args: {
  isCurrent: boolean;
  isCurrentCycle: boolean;
  requestedCycle: BillingCycle;
  targetPlanTier: number;
  currentPlanTier: number | null;
  currentCycle: BillingCycle | null;
}): PlanComparisonRow['cta'] {
  if (args.isCurrent && args.isCurrentCycle) return 'Current Plan';
  if (args.currentPlanTier === null) return 'Choose Plan';

  if (args.isCurrent && !args.isCurrentCycle) {
    return args.requestedCycle === BillingCycle.ANNUAL
      ? 'Switch to Annual'
      : 'Switch to Monthly';
  }

  if (args.targetPlanTier > args.currentPlanTier) return 'Upgrade Now';
  if (args.targetPlanTier < args.currentPlanTier) return 'Downgrade Next Cycle';

  // Same tier, different cycle: handled above; fallback.
  return 'Choose Plan';
}
