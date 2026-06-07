import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrganizationSubscriptionRepository } from '../../plan/repositories/organization-subscription.repository';
import { PlanRepository } from '../../plan/repositories/plan.repository';
import {
  OrganizationSubscription,
  SubscriptionStatus,
} from '../../plan/entities/organization-subscription.entity';
import { Plan, BillingCycle } from '../../plan/entities/plan.entity';
import { InvoiceService } from './invoice.service';
import { EmployeeCountService } from './employee-count.service';
import { GstCalculatorService } from './gst-calculator.service';
import { InvoiceStatus } from '../entities/invoice.entity';

export interface BillingOverviewResponse {
  subscription: {
    id: string | null;
    plan: { id: string; name: string; tier_rank: number } | null;
    billing_cycle: BillingCycle | null;
    sub_status: SubscriptionStatus | null;
    is_trial: boolean;
    start_date: Date | null;
    end_date: Date | null;
    next_renewal_date: Date | null;
    pending_plan_id: string | null;
    pending_billing_cycle: BillingCycle | null;
    renewal_cta: 'Upgrade Plan' | 'Renew Subscription' | 'Pay Invoice' | null;
  };
  // Set when the user has queued a downgrade or cycle-change for the next renewal.
  // null otherwise. The dashboard uses this to render a "Downgrading to X on Y" banner.
  pending_change: {
    plan: { id: string; name: string; tier_rank: number } | null;
    billing_cycle: BillingCycle | null;
    direction: 'tier_downgrade' | 'cycle_change' | null;
    effective_on: Date | null;
  } | null;
  trial: {
    is_trial: boolean;
    days_remaining: number | null;
    banner_level: 7 | 3 | 1 | null;
  };
  employee_billing: {
    active_employees: number;
    last_snapshot_count: number | null;
    price_per_employee: number;
    subtotal: number;
    gst_rate: number;
    gst_amount: number;
    estimated_total: number;
  };
  timeline: Array<{
    event:
      | 'TRIAL_STARTED'
      | 'TRIAL_ENDS'
      | 'INVOICE_GENERATED'
      | 'PAYMENT_DUE'
      | 'SUBSCRIPTION_RENEWED';
    date: Date | null;
    completed: boolean;
  }>;
  open_invoice_id: string | null;
}

@Injectable()
export class BillingOverviewService {
  constructor(
    private readonly subRepo: OrganizationSubscriptionRepository,
    private readonly planRepo: PlanRepository,
    private readonly invoiceService: InvoiceService,
    private readonly employeeCount: EmployeeCountService,
    private readonly gst: GstCalculatorService,
    private readonly config: ConfigService,
  ) {}

  async build(organizationId: string): Promise<BillingOverviewResponse> {
    const sub = await this.subRepo.findActiveByOrganization(organizationId);
    const plan = sub ? await this.planRepo.findOneById(sub.plan_id) : null;
    const pendingPlan = sub?.pending_plan_id
      ? await this.planRepo.findOneById(sub.pending_plan_id)
      : null;
    const headcount = await this.employeeCount.getActiveEmployeeCount(organizationId);
    const openInvoice = await this.invoiceService.findCurrent(organizationId);

    const unitPrice = plan
      ? sub!.billing_cycle === BillingCycle.ANNUAL
        ? Number(plan.price_per_employee_annual)
        : Number(plan.price)
      : 0;
    const subtotal = round2(headcount * unitPrice);
    const breakdown = this.gst.compute(subtotal);

    const daysRemaining = sub && sub.is_trial && sub.end_date
      ? daysUntil(sub.end_date)
      : null;
    const bannerLevel = pickBannerLevel(daysRemaining);

    const cta = pickRenewalCta(sub, openInvoice?.invoice_status ?? null);

    return {
      subscription: {
        id: sub?.id ?? null,
        plan: plan
          ? { id: plan.id, name: plan.name, tier_rank: plan.tier_rank }
          : null,
        billing_cycle: sub?.billing_cycle ?? null,
        sub_status: sub?.sub_status ?? null,
        is_trial: sub?.is_trial ?? false,
        start_date: sub?.start_date ?? null,
        end_date: sub?.end_date ?? null,
        next_renewal_date: sub?.next_renewal_date ?? null,
        pending_plan_id: sub?.pending_plan_id ?? null,
        pending_billing_cycle: sub?.pending_billing_cycle ?? null,
        renewal_cta: cta,
      },
      pending_change: this.buildPendingChange(sub, plan, pendingPlan),
      trial: {
        is_trial: sub?.is_trial ?? false,
        days_remaining: daysRemaining,
        banner_level: bannerLevel,
      },
      employee_billing: {
        active_employees: headcount,
        last_snapshot_count: openInvoice?.employee_count_snapshot ?? null,
        price_per_employee: unitPrice,
        subtotal: breakdown.subtotal,
        gst_rate: breakdown.gst_rate,
        gst_amount: breakdown.gst_amount,
        estimated_total: breakdown.total,
      },
      timeline: this.buildTimeline(sub, openInvoice),
      open_invoice_id: openInvoice?.id ?? null,
    };
  }

  private buildPendingChange(
    sub: OrganizationSubscription | null,
    currentPlan: Plan | null,
    pendingPlan: Plan | null,
  ): BillingOverviewResponse['pending_change'] {
    if (!sub) return null;
    if (!sub.pending_plan_id && !sub.pending_billing_cycle) return null;

    let direction: 'tier_downgrade' | 'cycle_change' | null = null;
    if (pendingPlan && currentPlan && pendingPlan.tier_rank !== currentPlan.tier_rank) {
      direction = 'tier_downgrade';
    } else if (
      sub.pending_billing_cycle &&
      sub.pending_billing_cycle !== sub.billing_cycle
    ) {
      direction = 'cycle_change';
    }

    return {
      plan: pendingPlan
        ? {
            id: pendingPlan.id,
            name: pendingPlan.name,
            tier_rank: pendingPlan.tier_rank,
          }
        : null,
      billing_cycle: sub.pending_billing_cycle,
      direction,
      effective_on: sub.next_renewal_date,
    };
  }

  private buildTimeline(
    sub: OrganizationSubscription | null,
    invoice: { invoice_date: Date; due_date: Date; invoice_status: InvoiceStatus } | null,
  ): BillingOverviewResponse['timeline'] {
    const trialStart = sub?.is_trial ? sub.start_date : null;
    const trialEnd = sub?.is_trial ? sub.end_date : null;
    const isTrialOver =
      sub && sub.end_date ? new Date() > new Date(sub.end_date) : false;

    return [
      {
        event: 'TRIAL_STARTED',
        date: trialStart ?? sub?.start_date ?? null,
        completed: !!sub,
      },
      {
        event: 'TRIAL_ENDS',
        date: trialEnd,
        completed: isTrialOver,
      },
      {
        event: 'INVOICE_GENERATED',
        date: invoice?.invoice_date ?? null,
        completed: !!invoice,
      },
      {
        event: 'PAYMENT_DUE',
        date: invoice?.due_date ?? null,
        completed: invoice?.invoice_status === InvoiceStatus.PAID,
      },
      {
        event: 'SUBSCRIPTION_RENEWED',
        date: sub?.next_renewal_date ?? null,
        completed:
          sub?.sub_status === SubscriptionStatus.ACTIVE &&
          !sub?.is_trial &&
          invoice?.invoice_status === InvoiceStatus.PAID,
      },
    ];
  }
}

function pickRenewalCta(
  sub: OrganizationSubscription | null,
  invoiceStatus: InvoiceStatus | null,
): 'Upgrade Plan' | 'Renew Subscription' | 'Pay Invoice' | null {
  if (!sub) return 'Upgrade Plan';
  if (
    invoiceStatus === InvoiceStatus.PENDING ||
    invoiceStatus === InvoiceStatus.FAILED ||
    invoiceStatus === InvoiceStatus.OVERDUE
  ) {
    return 'Pay Invoice';
  }
  if (
    sub.sub_status === SubscriptionStatus.EXPIRED ||
    sub.sub_status === SubscriptionStatus.GRACE
  ) {
    return 'Renew Subscription';
  }
  if (sub.is_trial) return 'Upgrade Plan';
  return null;
}

function pickBannerLevel(days: number | null): 7 | 3 | 1 | null {
  if (days === null || days < 0) return null;
  if (days <= 1) return 1;
  if (days <= 3) return 3;
  if (days <= 7) return 7;
  return null;
}

function daysUntil(d: Date): number {
  const ms = new Date(d).getTime() - Date.now();
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
