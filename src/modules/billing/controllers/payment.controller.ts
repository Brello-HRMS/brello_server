import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { LoggedInUser } from '../../../common/decorators/logged-in-user.decorator';
import type { LoggedInUser as LoggedInUserInterface } from '../../auth/interfaces/logged-in-user.interface';
import { PaymentService } from '../services/payment.service';
import {
  InitiatePaymentDto,
  VerifyPaymentDto,
} from '../dto/initiate-payment.dto';

@Controller('billing/payments')
@UseGuards(JwtAuthGuard)
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('initiate')
  @HttpCode(HttpStatus.CREATED)
  initiate(
    @LoggedInUser() user: LoggedInUserInterface,
    @Body() dto: InitiatePaymentDto,
  ) {
    return this.paymentService.initiate({
      invoiceId: dto.invoice_id,
      organizationId: user.organizationId,
      enterpriseId: user.enterpriseId ?? null,
    });
  }

  // Backend-generated hosted payment link. Returns short_url for the frontend
  // to redirect to — completion is confirmed via the payment_link.paid webhook.
  @Post('link')
  @HttpCode(HttpStatus.CREATED)
  createLink(
    @LoggedInUser() user: LoggedInUserInterface,
    @Body() dto: InitiatePaymentDto,
  ) {
    return this.paymentService.createPaymentLink({
      invoiceId: dto.invoice_id,
      organizationId: user.organizationId,
      enterpriseId: user.enterpriseId ?? null,
    });
  }

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  verify(
    @LoggedInUser() user: LoggedInUserInterface,
    @Body() dto: VerifyPaymentDto,
  ) {
    return this.paymentService.verify({
      organizationId: user.organizationId,
      razorpay_order_id: dto.razorpay_order_id,
      razorpay_payment_id: dto.razorpay_payment_id,
      razorpay_signature: dto.razorpay_signature,
    });
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  findOne(
    @LoggedInUser() user: LoggedInUserInterface,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.paymentService.findByIdForOrg(id, user.organizationId);
  }
}
