import {
  IsUUID,
  IsNotEmpty,
  IsEnum,
  IsDateString,
  IsOptional,
} from 'class-validator';
import { SubscriptionStatus } from '../entities/organization-subscription.entity';

export class CreateOrganizationSubscriptionDto {
  @IsUUID('4')
  @IsNotEmpty()
  organization_id: string;

  @IsUUID('4')
  @IsNotEmpty()
  plan_id: string;

  @IsDateString()
  @IsNotEmpty()
  start_date: string;

  @IsDateString()
  @IsOptional()
  end_date?: string;

  @IsEnum(SubscriptionStatus)
  @IsOptional()
  status?: SubscriptionStatus;
}

export class UpdateOrganizationSubscriptionDto {
  @IsDateString()
  @IsOptional()
  end_date?: string;

  @IsEnum(SubscriptionStatus)
  @IsOptional()
  status?: SubscriptionStatus;
}
