import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface GstBreakdown {
  subtotal: number;
  gst_rate: number;
  gst_amount: number;
  total: number;
}

@Injectable()
export class GstCalculatorService {
  private readonly defaultRate: number;

  constructor(private readonly config: ConfigService) {
    this.defaultRate = Number(this.config.get('billing.GST_RATE') ?? 18);
  }

  getRate(): number {
    return this.defaultRate;
  }

  compute(subtotal: number, rate: number = this.defaultRate): GstBreakdown {
    const gst_amount = round2((subtotal * rate) / 100);
    return {
      subtotal: round2(subtotal),
      gst_rate: rate,
      gst_amount,
      total: round2(subtotal + gst_amount),
    };
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
