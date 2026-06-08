import {
  Injectable,
  Logger,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import Razorpay from 'razorpay';

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  status: string;
}

export interface RazorpayPaymentLink {
  id: string;
  short_url: string;
  status: string;
}

@Injectable()
export class RazorpayService {
  private readonly logger = new Logger(RazorpayService.name);
  private readonly client: Razorpay;
  private readonly keyId: string;
  private readonly keySecret: string;
  private readonly webhookSecret: string;

  constructor(private readonly config: ConfigService) {
    this.keyId = this.config.get<string>('billing.RAZORPAY_KEY_ID') ?? '';
    this.keySecret = this.config.get<string>('billing.RAZORPAY_KEY_SECRET') ?? '';
    this.webhookSecret =
      this.config.get<string>('billing.RAZORPAY_WEBHOOK_SECRET') ?? '';

    this.client = new Razorpay({
      key_id: this.keyId,
      key_secret: this.keySecret,
    });
  }

  getKeyId(): string {
    return this.keyId;
  }

  // Create order. Amount in paise (₹4395.50 → 439550).
  async createOrder(args: {
    amountInPaise: number;
    currency?: string;
    receipt: string;
    notes?: Record<string, string>;
  }): Promise<RazorpayOrder> {
    try {
      const order = await this.client.orders.create({
        amount: args.amountInPaise,
        currency: args.currency ?? 'INR',
        receipt: args.receipt,
        notes: args.notes,
      });
      return {
        id: order.id,
        amount: Number(order.amount),
        currency: order.currency,
        status: order.status,
      };
    } catch (err) {
      this.logger.error('Razorpay order creation failed', err as Error);
      throw new InternalServerErrorException('Unable to create payment order');
    }
  }

  // Create a hosted Payment Link. Amount in paise. reference_id must be unique
  // (we use the Payment record id) so Razorpay rejects duplicates and we can
  // correlate the webhook back to our payment.
  async createPaymentLink(args: {
    amountInPaise: number;
    currency?: string;
    referenceId: string;
    description: string;
    customer?: { name?: string; email?: string; contact?: string };
    callbackUrl?: string;
    notes?: Record<string, string>;
  }): Promise<RazorpayPaymentLink> {
    try {
      const payload: Record<string, unknown> = {
        amount: args.amountInPaise,
        currency: args.currency ?? 'INR',
        reference_id: args.referenceId,
        description: args.description,
        notify: { sms: false, email: Boolean(args.customer?.email) },
        reminder_enable: true,
        notes: args.notes,
      };
      if (args.customer && (args.customer.email || args.customer.contact)) {
        payload.customer = args.customer;
      }
      if (args.callbackUrl) {
        payload.callback_url = args.callbackUrl;
        payload.callback_method = 'get';
      }

      const link = await this.client.paymentLink.create(payload as never);
      return {
        id: link.id as string,
        short_url: link.short_url as string,
        status: link.status as string,
      };
    } catch (err) {
      this.logger.error('Razorpay payment link creation failed', err as Error);
      throw new InternalServerErrorException('Unable to create payment link');
    }
  }

  // Cancel a hosted Payment Link (e.g. when superseded). Best-effort.
  async cancelPaymentLink(paymentLinkId: string): Promise<void> {
    try {
      await this.client.paymentLink.cancel(paymentLinkId);
    } catch (err) {
      this.logger.warn(
        `Failed to cancel payment link ${paymentLinkId}: ${String(err)}`,
      );
    }
  }

  // Verify checkout signature: HMAC_SHA256(orderId|paymentId, keySecret).
  verifyCheckoutSignature(args: {
    orderId: string;
    paymentId: string;
    signature: string;
  }): boolean {
    const expected = crypto
      .createHmac('sha256', this.keySecret)
      .update(`${args.orderId}|${args.paymentId}`)
      .digest('hex');
    return safeEqual(expected, args.signature);
  }

  // Verify webhook signature: HMAC_SHA256(rawBody, webhookSecret).
  verifyWebhookSignature(rawBody: string, signature: string | undefined): void {
    if (!signature) {
      throw new UnauthorizedException('Missing webhook signature');
    }
    const expected = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(rawBody)
      .digest('hex');
    if (!safeEqual(expected, signature)) {
      throw new UnauthorizedException('Invalid webhook signature');
    }
  }
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}
