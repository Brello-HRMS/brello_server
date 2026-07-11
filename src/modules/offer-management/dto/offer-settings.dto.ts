import {
  IsString,
  IsOptional,
  IsUUID,
  IsNumber,
  IsBoolean,
  IsArray,
  IsNotEmpty,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class ApprovalChainItemDto {
  @IsString()
  @IsNotEmpty()
  role_name: string;

  @IsNumber()
  @IsOptional()
  requires_at_ctc_above?: number;
}

export class UpdateOfferSettingsDto {
  @IsString()
  @IsOptional()
  offer_prefix?: string;

  @IsNumber()
  @IsOptional()
  @Min(1)
  offer_expiry_days?: number;

  @IsArray()
  @IsNumber({}, { each: true })
  @IsOptional()
  reminder_days_before_expiry?: number[];

  @IsUUID()
  @IsOptional()
  default_template_id?: string;

  @IsUUID()
  @IsOptional()
  default_signatory_id?: string;

  @IsBoolean()
  @IsOptional()
  allow_download?: boolean;

  @IsBoolean()
  @IsOptional()
  enable_request_changes?: boolean;

  @IsBoolean()
  @IsOptional()
  enable_digital_signature?: boolean;

  @IsBoolean()
  @IsOptional()
  auto_welcome_email?: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ApprovalChainItemDto)
  @IsOptional()
  approval_chain?: ApprovalChainItemDto[];
}
