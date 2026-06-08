import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
  ConflictException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InvoiceRepository } from '../repositories/invoice.repository';
import { PaymentRepository } from '../repositories/payment.repository';
import { OrganizationSubscriptionRepository } from '../../plan/repositories/organization-subscription.repository';
import { RazorpayService } from './razorpay.service';
import { InvoiceService } from './invoice.service';
import {
  Payment,
  PaymentStatus,
} from '../entities/payment.entity';
import { Invoice, InvoiceStatus } from '../entities/invoice.entity';
import {
  SubscriptionStatus,
} from '../../plan/entities/organization-subscription.entity';
import { BillingCycle } from '../../plan/entities/plan.entity';
import { Status } from 'src/common/enums';

export interface InitiateResponse {
  payment_id: string;
  razorpay_order_id: string;
  razorpay_key_id: string;
  amount: number;
  currency: string;
  invoice_number: string;
}

export interface VerifyResponse {
  status: PaymentStatus;
  invoice: Invoice;
  next_renewal_date: Date | null;
}

export interface PaymentLinkResponse {
  payment_id: string;
  payment_link_id: string;
  short_url: string;
  amount: number;
  currency: string;
  invoice_number: string;
  status: string;
}

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private readonly paymentRepo: PaymentRepository,
    private readonly invoiceRepo: InvoiceRepository,
    private readonly invoiceService: InvoiceService,
    private readonly subscriptionRepo: OrganizationSubscriptionRepository,
    private readonly razorpay: RazorpayService,
    private readonly config: ConfigService,
  ) {}

  async initiate(args: {
    invoiceId: string;
    organizationId: string;
    enterpriseId: string | null;
  }): Promise<InitiateResponse> {
    const invoice = await this.invoiceRepo.findOneById(
      args.invoiceId,
      args.organizationId,
    );
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (invoice.invoice_status === InvoiceStatus.PAID) {
      throw new ConflictException('Invoice is already paid');
    }

    const amountPaise = Math.round(Number(invoice.total) * 100);
    const order = await this.razorpay.createOrder({
      amountInPaise: amountPaise,
      currency: 'INR',
      receipt: invoice.invoice_number,
      notes: {
        invoice_id: invoice.id,
        organization_id: args.organizationId,
      },
    });

    const payment = this.paymentRepo.create({
      invoice_id: invoice.id,
      organization_id: args.organizationId,
      enterprise_id: args.enterpriseId ?? undefined,
      razorpay_order_id: order.id,
      amount: Number(invoice.total),
      currency: order.currency,
      payment_status: PaymentStatus.INITIATED,
      status: Status.ACTIVE,
    });
    const saved = await this.paymentRepo.save(payment);

    return {
      payment_id: saved.id,
      razorpay_order_id: order.id,
      razorpay_key_id: this.razorpay.getKeyId(),
      amount: amountPaise,
      currency: order.currency,
      invoice_number: invoice.invoice_number,
    };
  }

  // Backend-generated hosted payment link. The frontend just opens short_url —
  // no Razorpay Checkout JS needed. Completion arrives via the payment_link.paid
  // webhook.
  async createPaymentLink(args: {
    invoiceId: string;
    organizationId: string;
    enterpriseId: string | null;
  }): Promise<PaymentLinkResponse> {
    const invoice = await this.invoiceRepo.findOneById(
      args.invoiceId,
      args.organizationId,
    );
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (invoice.invoice_status === InvoiceStatus.PAID) {
      throw new ConflictException('Invoice is already paid');
    }

    const amountPaise = Math.round(Number(invoice.total) * 100);

    // Persist the payment first so its id can be the link's unique reference_id.
    const payment = this.paymentRepo.create({
      invoice_id: invoice.id,
      organization_id: args.organizationId,
      enterprise_id: args.enterpriseId ?? undefined,
      amount: Number(invoice.total),
      currency: 'INR',
      payment_status: PaymentStatus.INITIATED,
      status: Status.ACTIVE,
    });
    const saved = await this.paymentRepo.save(payment);

    const snapshot = (invoice.billing_profile_snapshot ?? {}) as {
      legal_business_name?: string;
      billing_email?: string;
    };
    const callbackUrl =
      this.config.get<string>('billing.PAYMENT_CALLBACK_URL') || undefined;

    try {
      const link = await this.razorpay.createPaymentLink({
        amountInPaise: amountPaise,
        currency: 'INR',
        referenceId: saved.id,
        description: `Invoice ${invoice.invoice_number}`,
        customer: {
          name: snapshot.legal_business_name,
          email: snapshot.billing_email,
        },
        callbackUrl,
        notes: {
          invoice_id: invoice.id,
          organization_id: args.organizationId,
          payment_id: saved.id,
        },
      });

      saved.razorpay_payment_link_id = link.id;
      saved.short_url = link.short_url;
      await this.paymentRepo.save(saved);

      return {
        payment_id: saved.id,
        payment_link_id: link.id,
        short_url: link.short_url,
        amount: amountPaise,
        currency: 'INR',
        invoice_number: invoice.invoice_number,
        status: link.status,
      };
    } catch (err) {
      // Roll the placeholder payment back to FAILED so it isn't left dangling.
      saved.payment_status = PaymentStatus.FAILED;
      saved.failure_reason = 'Payment link creation failed';
      await this.paymentRepo.save(saved);
      throw err;
    }
  }

  async verify(args: {
    organizationId: string;
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }): Promise<VerifyResponse> {
    const ok = this.razorpay.verifyCheckoutSignature({
      orderId: args.razorpay_order_id,
      paymentId: args.razorpay_payment_id,
      signature: args.razorpay_signature,
    });
    if (!ok) throw new BadRequestException('Invalid payment signature');

    const payment = await this.paymentRepo.findByRazorpayOrderId(
      args.razorpay_order_id,
    );
    if (!payment) throw new NotFoundException('Payment record not found');
    if (payment.organization_id !== args.organizationId) {
      throw new BadRequestException('Payment does not belong to this organization');
    }

    // Idempotent: if already Success, just return current state.
    if (payment.payment_status === PaymentStatus.SUCCESS) {
      const invoice = await this.invoiceRepo.findOneById(
        payment.invoice_id,
        args.organizationId,
      );
      return {
        status: PaymentStatus.SUCCESS,
        invoice: invoice!,
        next_renewal_date: await this.getNextRenewal(invoice!.subscription_id),
      };
    }

    payment.razorpay_payment_id = args.razorpay_payment_id;
    payment.razorpay_signature = args.razorpay_signature;
    payment.payment_status = PaymentStatus.SUCCESS;
    payment.paid_at = new Date();
    await this.paymentRepo.save(payment);

    const invoice = await this.invoiceRepo.findOneById(
      payment.invoice_id,
      args.organizationId,
    );
    if (!invoice) throw new NotFoundException('Invoice not found');

    await this.invoiceService.markPaid(invoice);
    const nextRenewal = await this.renewSubscriptionForInvoice(invoice);

    return {
      status: PaymentStatus.SUCCESS,
      invoice,
      next_renewal_date: nextRenewal,
    };
  }

  // Webhook handlers — invoked from RazorpayWebhookController after signature
  // verification. Handles both Checkout orders (payment.captured / order.paid)
  // and hosted Payment Links (payment_link.paid).
  async handleWebhookEvent(event: {
    event: string;
    payload: {
      payment?: { entity?: any };
      order?: { entity?: any };
      payment_link?: { entity?: any };
    };
  }): Promise<void> {
    const paymentEntity = event.payload?.payment?.entity;
    const linkEntity = event.payload?.payment_link?.entity;
    const paymentId: string | undefined = paymentEntity?.id;

    // Idempotent: a captured payment id we've already marked succeeded → skip.
    if (paymentId) {
      const existing = await this.paymentRepo.findByRazorpayPaymentId(paymentId);
      if (existing?.payment_status === PaymentStatus.SUCCESS) return;
    }

    const payment = await this.resolvePayment(paymentEntity, linkEntity);
    if (!payment) {
      this.logger.warn(
        `Webhook ${event.event} could not be matched to a payment ` +
          `(order=${paymentEntity?.order_id ?? '-'}, link=${linkEntity?.id ?? '-'})`,
      );
      return;
    }

    if (paymentId) payment.razorpay_payment_id = paymentId;
    if (linkEntity?.id) payment.razorpay_payment_link_id = linkEntity.id;
    payment.raw_webhook_payload = event as unknown as Record<string, unknown>;

    const isSuccess =
      event.event === 'payment.captured' ||
      event.event === 'order.paid' ||
      event.event === 'payment_link.paid';

    if (isSuccess) {
      payment.payment_status = PaymentStatus.SUCCESS;
      payment.paid_at = new Date();
      await this.paymentRepo.save(payment);

      const invoice = await this.invoiceRepo.findOneById(
        payment.invoice_id,
        payment.organization_id,
      );
      if (invoice && invoice.invoice_status !== InvoiceStatus.PAID) {
        await this.invoiceService.markPaid(invoice);
        await this.renewSubscriptionForInvoice(invoice);
      }
    } else if (event.event === 'payment.failed') {
      payment.payment_status = PaymentStatus.FAILED;
      payment.failure_reason =
        paymentEntity?.error_description ?? paymentEntity?.error_code ?? null;
      await this.paymentRepo.save(payment);

      const invoice = await this.invoiceRepo.findOneById(
        payment.invoice_id,
        payment.organization_id,
      );
      if (invoice) await this.invoiceService.markFailed(invoice);
    }
  }

  // Match an incoming webhook to our Payment row — by payment-link id first
  // (link flow), falling back to the order id (Checkout flow).
  private async resolvePayment(
    paymentEntity: any,
    linkEntity: any,
  ): Promise<Payment | null> {
    if (linkEntity?.id) {
      const byLink = await this.paymentRepo.findByRazorpayPaymentLinkId(
        linkEntity.id,
      );
      if (byLink) return byLink;
    }
    if (paymentEntity?.order_id) {
      return this.paymentRepo.findByRazorpayOrderId(paymentEntity.order_id);
    }
    return null;
  }

  private async renewSubscriptionForInvoice(invoice: Invoice): Promise<Date | null> {
    const sub = await this.subscriptionRepo.findOneById(invoice.subscription_id);
    if (!sub) return null;

    const baseDate = sub.end_date && sub.end_date > new Date() ? sub.end_date : new Date();
    const nextRenewal = addCycle(baseDate, invoice.billing_cycle);

    sub.sub_status = SubscriptionStatus.ACTIVE;
    sub.is_trial = false;
    sub.grace_period_ends_at = null;
    sub.end_date = nextRenewal;
    sub.next_renewal_date = nextRenewal;

    // Apply pending plan/cycle change if invoice matches the new (pending) plan.
    if (sub.pending_plan_id && sub.pending_plan_id === invoice.plan_id_snapshot) {
      sub.plan_id = sub.pending_plan_id;
      sub.pending_plan_id = null;
    }
    if (sub.pending_billing_cycle && sub.pending_billing_cycle === invoice.billing_cycle) {
      sub.billing_cycle = sub.pending_billing_cycle;
      sub.pending_billing_cycle = null;
    }

    await this.subscriptionRepo.save(sub);
    return nextRenewal;
  }

  private async getNextRenewal(subscriptionId: string): Promise<Date | null> {
    const sub = await this.subscriptionRepo.findOneById(subscriptionId);
    return sub?.next_renewal_date ?? null;
  }

  async findByIdForOrg(
    paymentId: string,
    organizationId: string,
  ): Promise<Payment> {
    const payment = await this.paymentRepo.findById(paymentId, organizationId);
    if (!payment) throw new NotFoundException('Payment not found');
    return payment;
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
