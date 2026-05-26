import {
  IsOptional,
  IsString,
  IsEmail,
  MaxLength,
} from 'class-validator';

export class UpsertBillingProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  legal_business_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(15)
  gst_number?: string;

  @IsOptional()
  @IsString()
  billing_address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  state?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string;

  @IsOptional()
  @IsString()
  @MaxLength(6)
  pincode?: string;

  @IsOptional()
  @IsEmail()
  billing_email?: string;
}
