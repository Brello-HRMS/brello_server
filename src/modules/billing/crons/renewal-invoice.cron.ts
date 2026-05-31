import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import {
  OrganizationSubscription,
  SubscriptionStatus,
} from '../../plan/entities/organization-subscription.entity';
import { Plan, BillingCycle } from '../../plan/entities/plan.entity';
import { InvoiceService } from '../services/invoice.service';
import { Status } from 'src/common/enums';

@Injectable()
export class RenewalInvoiceCron {
  private readonly logger = new Logger(RenewalInvoiceCron.name);

  constructor(
    @InjectRepository(OrganizationSubscription)
    private readonly subRepo: Repository<OrganizationSubscription>,
    @InjectRepository(Plan)
    private readonly planRepo: Repository<Plan>,
    private readonly invoiceService: InvoiceService,
  ) {}

  // Daily 02:00 server time. Generates an invoice for each subscription whose next_renewal_date falls today.
  @Cron('0 0 2 * * *')
  async run(): Promise<void> {
    const dayStart = startOfDay(new Date());
    const dayEnd = endOfDay(new Date());

    const renewals = await this.subRepo.find({
      where: {
        status: Status.ACTIVE,
        sub_status: SubscriptionStatus.ACTIVE,
        next_renewal_date: Between(dayStart, dayEnd),
      },
    });

    for (const sub of renewals) {
      // Apply pending plan/cycle changes (downgrades / cycle-down) at renewal.
      const effectivePlanId = sub.pending_plan_id ?? sub.plan_id;
      const effectiveCycle: BillingCycle =
        sub.pending_billing_cycle ?? sub.billing_cycle;
      const plan = await this.planRepo.findOne({
        where: { id: effectivePlanId, status: Status.ACTIVE },
      });
      if (!plan) {
        this.logger.warn(
          `Skipping renewal for sub ${sub.id} — plan ${effectivePlanId} not found`,
        );
        continue;
      }

      const periodStart = new Date(sub.next_renewal_date);
      const periodEnd = addCycle(periodStart, effectiveCycle);

      try {
        await this.invoiceService.generate({
          subscription: sub,
          plan,
          billingCycle: effectiveCycle,
          organizationId: sub.organization_id,
          enterpriseId: sub.enterprise_id ?? null,
          periodStart,
          periodEnd,
        });
        this.logger.log(
          `Generated renewal invoice for sub ${sub.id} (${plan.name} ${effectiveCycle})`,
        );
      } catch (err) {
        this.logger.error(
          `Renewal invoice failed for sub ${sub.id}`,
          err as Error,
        );
      }
    }
  }
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}
function addCycle(base: Date, cycle: BillingCycle): Date {
  const d = new Date(base);
  if (cycle === BillingCycle.ANNUAL) d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1);
  return d;
}
