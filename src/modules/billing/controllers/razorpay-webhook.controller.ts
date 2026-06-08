import {
  Controller,
  Post,
  Req,
  Headers,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '../../../common/decorators/public.decorator';
import { RazorpayService } from '../services/razorpay.service';
import { PaymentService } from '../services/payment.service';

@Controller('billing/webhooks/razorpay')
export class RazorpayWebhookController {
  constructor(
    private readonly razorpay: RazorpayService,
    private readonly paymentService: PaymentService,
  ) {}

  @Post()
  @Public()
  @HttpCode(HttpStatus.OK)
  async handle(
    @Req() req: Request & { rawBody?: Buffer },
    @Headers('x-razorpay-signature') signature: string,
  ) {
    const rawBody = req.rawBody ? req.rawBody.toString('utf8') : '';
    this.razorpay.verifyWebhookSignature(rawBody, signature);

    const event = req.body as {
      event: string;
      payload: {
        payment?: { entity?: any };
        order?: { entity?: any };
        payment_link?: { entity?: any };
      };
    };
    await this.paymentService.handleWebhookEvent(event);
    return { received: true };
  }
}
