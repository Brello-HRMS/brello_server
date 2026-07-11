import { IsUUID, IsOptional, IsObject, IsString, IsDateString, IsEnum } from 'class-validator';
import { IssuedLetterDeliveryStatus } from '../enums/issued-letter-delivery-status.enum';

export class GenerateIssuedLetterDto {
  @IsUUID()
  employee_id: string;

  @IsUUID()
  template_id: string;

  @IsObject()
  @IsOptional()
  manual_values?: Record<string, string>;
}

export class ResolveIssuedLetterDto {
  @IsUUID()
  employee_id: string;

  @IsUUID()
  template_id: string;
}

export class IssuedLetterFiltersDto {
  @IsUUID()
  @IsOptional()
  employee_id?: string;

  @IsUUID()
  @IsOptional()
  category_id?: string;

  @IsUUID()
  @IsOptional()
  template_id?: string;

  @IsString()
  @IsOptional()
  letter_number?: string;

  @IsDateString()
  @IsOptional()
  date_from?: string;

  @IsDateString()
  @IsOptional()
  date_to?: string;

  @IsEnum(IssuedLetterDeliveryStatus)
  @IsOptional()
  delivery_status?: IssuedLetterDeliveryStatus;
}
