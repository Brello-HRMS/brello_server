import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment, PaymentStatus } from '../entities/payment.entity';
import { Status } from 'src/common/enums';

@Injectable()
export class PaymentRepository {
  constructor(
    @InjectRepository(Payment)
    private readonly repository: Repository<Payment>,
  ) {}

  create(data: Partial<Payment>): Payment {
    return this.repository.create(data);
  }

  save(payment: Payment): Promise<Payment> {
    return this.repository.save(payment);
  }

  findById(id: string, organizationId: string): Promise<Payment | null> {
    return this.repository.findOne({
      where: { id, organization_id: organizationId, status: Status.ACTIVE },
    });
  }

  findByRazorpayOrderId(orderId: string): Promise<Payment | null> {
    return this.repository.findOne({
      where: { razorpay_order_id: orderId, status: Status.ACTIVE },
    });
  }

  findByRazorpayPaymentId(paymentId: string): Promise<Payment | null> {
    return this.repository.findOne({
      where: { razorpay_payment_id: paymentId, status: Status.ACTIVE },
    });
  }

  findLatestForInvoice(invoiceId: string): Promise<Payment | null> {
    return this.repository.findOne({
      where: { invoice_id: invoiceId, status: Status.ACTIVE },
      order: { created_at: 'DESC' },
    });
  }
}
