import { IsUUID, IsEnum } from 'class-validator';
import { BillingCycle } from '../../plan/entities/plan.entity';

export class ChangePlanDto {
  @IsUUID('4')
  plan_id: string;

  @IsEnum(BillingCycle)
  billing_cycle: BillingCycle;
}
