import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEmail,
  IsUUID,
  IsNumber,
  MaxLength,
  Min,
  Max,
} from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';

export class CreateOfferCandidateDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  first_name: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  last_name: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsOptional()
  @MaxLength(20)
  phone?: string;

  @IsString()
  @IsOptional()
  @MaxLength(150)
  current_company?: string;

  @IsString()
  @IsOptional()
  @MaxLength(150)
  current_designation?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(60)
  experience_years?: number;

  @IsString()
  @IsOptional()
  @MaxLength(150)
  applied_for?: string;

  @IsUUID()
  @IsOptional()
  recruiter_id?: string;

  @IsString()
  @IsOptional()
  recruiter_notes?: string;
}

export class UpdateOfferCandidateDto extends PartialType(CreateOfferCandidateDto) {}

export class FilterCandidatesDto {
  @IsString()
  @IsOptional()
  search?: string;

  @IsUUID()
  @IsOptional()
  recruiter_id?: string;
}
