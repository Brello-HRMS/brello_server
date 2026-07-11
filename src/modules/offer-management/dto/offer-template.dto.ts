import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsBoolean,
  MaxLength,
  IsEnum,
} from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';
import { OfferTemplateStatus } from '../enums/offer-template-status.enum';

export class CreateOfferTemplateDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;

  @IsString()
  @IsOptional()
  body?: string;

  @IsUUID()
  @IsOptional()
  signatory_id?: string;

  @IsBoolean()
  @IsOptional()
  include_salary_table?: boolean;
}

export class UpdateOfferTemplateDto extends PartialType(CreateOfferTemplateDto) {}

export class FilterOfferTemplatesDto {
  @IsEnum(OfferTemplateStatus)
  @IsOptional()
  template_status?: OfferTemplateStatus;

  @IsString()
  @IsOptional()
  search?: string;
}
