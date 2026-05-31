import { IsEnum, IsOptional } from 'class-validator';
import { BillingCycle } from '../../plan/entities/plan.entity';

export class ListPlansDto {
  @IsOptional()
  @IsEnum(BillingCycle)
  cycle?: BillingCycle;
}
