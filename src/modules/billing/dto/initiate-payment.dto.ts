import { IsUUID, IsString, IsNotEmpty } from 'class-validator';

export class InitiatePaymentDto {
  @IsUUID('4')
  invoice_id: string;
}

export class VerifyPaymentDto {
  @IsString()
  @IsNotEmpty()
  razorpay_order_id: string;

  @IsString()
  @IsNotEmpty()
  razorpay_payment_id: string;

  @IsString()
  @IsNotEmpty()
  razorpay_signature: string;
}
