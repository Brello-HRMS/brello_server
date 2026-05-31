import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InvoiceRepository } from '../repositories/invoice.repository';
import { Invoice, InvoiceStatus } from '../entities/invoice.entity';
import { InvoiceLineItem } from '../entities/invoice-line-item.entity';
import {
  OrganizationSubscription,
} from '../../plan/entities/organization-subscription.entity';
import { Plan, BillingCycle } from '../../plan/entities/plan.entity';
import { EmployeeCountService } from './employee-count.service';
import { GstCalculatorService } from './gst-calculator.service';
import { BillingProfileService } from './billing-profile.service';
import { Status } from 'src/common/enums';

export interface GenerateInvoiceInput {
  subscription: OrganizationSubscription;
  plan: Plan;
  billingCycle: BillingCycle;
  organizationId: string;
  enterpriseId: string | null;
  periodStart: Date;
  periodEnd: Date;
  // Override headcount (e.g. for proration); otherwise live snapshot is used.
  employeeCountOverride?: number;
  // Optional unit price override (proration). Otherwise plan price is used.
  unitPriceOverride?: number;
  description?: string;
}

@Injectable()
export class InvoiceService {
  private readonly logger = new Logger(InvoiceService.name);
  private readonly dueDays: number;

  constructor(
    private readonly invoiceRepo: InvoiceRepository,
    private readonly employeeCount: EmployeeCountService,
    private readonly gst: GstCalculatorService,
    private readonly billingProfileService: BillingProfileService,
    private readonly config: ConfigService,
    @InjectRepository(InvoiceLineItem)
    private readonly lineItemRepo: Repository<InvoiceLineItem>,
  ) {
    this.dueDays = Number(this.config.get('billing.INVOICE_DUE_DAYS') ?? 7);
  }

  async findCurrent(organizationId: string): Promise<Invoice | null> {
    return this.invoiceRepo.findCurrentForOrg(organizationId);
  }

  async findOne(id: string, organizationId: string): Promise<Invoice> {
    const invoice = await this.invoiceRepo.findOneById(id, organizationId);
    if (!invoice) throw new NotFoundException('Invoice not found');
    return invoice;
  }

  async list(
    organizationId: string,
    opts: {
      invoice_status?: InvoiceStatus;
      from?: Date;
      to?: Date;
      page: number;
      limit: number;
    },
  ): Promise<{ data: Invoice[]; total: number; page: number; limit: number }> {
    const { data, total } = await this.invoiceRepo.findAllForOrg(
      organizationId,
      opts,
    );
    return { data, total, page: opts.page, limit: opts.limit };
  }

  async generate(input: GenerateInvoiceInput): Promise<Invoice> {
    const headcount =
      input.employeeCountOverride ??
      (await this.employeeCount.getActiveEmployeeCount(input.organizationId));

    const unitPrice =
      input.unitPriceOverride ??
      (input.billingCycle === BillingCycle.ANNUAL
        ? Number(input.plan.price_per_employee_annual)
        : Number(input.plan.price));

    const subtotal = round2(headcount * unitPrice);
    const breakdown = this.gst.compute(subtotal);

    const yyyymm = monthKey(input.periodStart);
    const seq = await this.invoiceRepo.nextSequenceForMonth(yyyymm);
    const invoiceNumber = `BRL-${yyyymm}-${String(seq).padStart(4, '0')}`;

    const billingProfile = await this.billingProfileService.getOrCreate(
      input.organizationId,
    );

    const dueDate = new Date(input.periodStart);
    dueDate.setDate(dueDate.getDate() + this.dueDays);

    const invoice = this.invoiceRepo.create({
      organization_id: input.organizationId,
      enterprise_id: input.enterpriseId ?? undefined,
      invoice_number: invoiceNumber,
      subscription_id: input.subscription.id,
      plan_id_snapshot: input.plan.id,
      plan_name_snapshot: input.plan.name,
      billing_cycle: input.billingCycle,
      billing_profile_snapshot: serializeBillingProfile(billingProfile),
      billing_period_start: input.periodStart,
      billing_period_end: input.periodEnd,
      invoice_date: new Date(),
      due_date: dueDate,
      employee_count_snapshot: headcount,
      price_per_employee: unitPrice,
      subtotal: breakdown.subtotal,
      gst_rate: breakdown.gst_rate,
      gst_amount: breakdown.gst_amount,
      total: breakdown.total,
      invoice_status: InvoiceStatus.PENDING,
      status: Status.ACTIVE,
    });

    const saved = await this.invoiceRepo.save(invoice);

    const lineItem = this.lineItemRepo.create({
      invoice_id: saved.id,
      organization_id: input.organizationId,
      enterprise_id: input.enterpriseId ?? undefined,
      line_description:
        input.description ??
        `${input.plan.name} Plan Users (${input.billingCycle})`,
      quantity: headcount,
      unit_price: unitPrice,
      amount: subtotal,
      status: Status.ACTIVE,
    });
    await this.lineItemRepo.save(lineItem);

    saved.line_items = [lineItem];
    return saved;
  }

  async markPaid(invoice: Invoice): Promise<Invoice> {
    invoice.invoice_status = InvoiceStatus.PAID;
    invoice.paid_at = new Date();
    return this.invoiceRepo.save(invoice);
  }

  async markFailed(invoice: Invoice): Promise<Invoice> {
    invoice.invoice_status = InvoiceStatus.FAILED;
    return this.invoiceRepo.save(invoice);
  }

  async attachPdfKey(invoice: Invoice, key: string): Promise<Invoice> {
    invoice.pdf_s3_key = key;
    return this.invoiceRepo.save(invoice);
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function monthKey(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${yyyy}${mm}`;
}

function serializeBillingProfile(p: {
  legal_business_name: string | null;
  gst_number: string | null;
  billing_address: string | null;
  state: string | null;
  country: string;
  pincode: string | null;
  billing_email: string | null;
}): Record<string, unknown> {
  return {
    legal_business_name: p.legal_business_name,
    gst_number: p.gst_number,
    billing_address: p.billing_address,
    state: p.state,
    country: p.country,
    pincode: p.pincode,
    billing_email: p.billing_email,
  };
}
