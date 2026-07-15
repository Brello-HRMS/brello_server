import {
  IsString,
  IsOptional,
  IsUUID,
  IsNumber,
  IsEnum,
  IsDateString,
  IsArray,
  IsBoolean,
  IsNotEmpty,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { PartialType } from '@nestjs/mapped-types';
import { EmploymentType, WorkMode } from '../entities/offer-candidate.entity';
import { PaginationDto } from '../../../common/dto/pagination.dto';

// class-validator's @IsOptional() only skips validation for null/undefined —
// an empty string still reaches @IsEnum/@IsDateString/@IsUUID and fails them,
// even though the field is meant to be optional. Wizard-style forms
// (unfilled <select>/<input type="date">) naturally submit '' rather than
// omitting the key, so normalize '' -> undefined before validation runs on
// any optional enum/date/uuid field below.
const emptyStringToUndefined = () =>
  Transform(({ value }) => (value === '' ? undefined : value));

class SalaryComponentDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsNumber()
  amount: number;

  @IsEnum(['fixed', 'variable'])
  type: 'fixed' | 'variable';
}

/** Step 2: Offer Details */
export class OfferDetailsDto {
  @IsString()
  @IsOptional()
  position?: string;

  @emptyStringToUndefined()
  @IsUUID()
  @IsOptional()
  department_id?: string;

  @emptyStringToUndefined()
  @IsUUID()
  @IsOptional()
  designation_id?: string;

  @emptyStringToUndefined()
  @IsEnum(EmploymentType)
  @IsOptional()
  employment_type?: EmploymentType;

  @emptyStringToUndefined()
  @IsDateString()
  @IsOptional()
  joining_date?: string;

  @emptyStringToUndefined()
  @IsUUID()
  @IsOptional()
  reporting_manager_id?: string;

  @emptyStringToUndefined()
  @IsEnum(WorkMode)
  @IsOptional()
  work_mode?: WorkMode;

  @IsString()
  @IsOptional()
  work_location?: string;

  @IsString()
  @IsOptional()
  office_address?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  probation_days?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  notice_period_days?: number;
}

/** Step 3: Compensation */
export class OfferCompensationDto {
  @emptyStringToUndefined()
  @IsUUID()
  @IsOptional()
  salary_structure_id?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  ctc_annual?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  monthly_take_home?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SalaryComponentDto)
  @IsOptional()
  salary_components?: SalaryComponentDto[];
}

/** Step 4: Policies */
export class OfferPoliciesDto {
  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  policy_ids?: string[];
}

/** Full create/update DTO (wizard data merged together) */
export class CreateOfferDto {
  @IsUUID()
  @IsNotEmpty()
  candidate_id: string;

  @emptyStringToUndefined()
  @IsUUID()
  @IsOptional()
  template_id?: string;

  // Offer Details
  @IsOptional()
  @ValidateNested()
  @Type(() => OfferDetailsDto)
  details?: OfferDetailsDto;

  // Compensation
  @IsOptional()
  @ValidateNested()
  @Type(() => OfferCompensationDto)
  compensation?: OfferCompensationDto;

  // Policies
  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  policy_ids?: string[];
}

export class UpdateOfferDto {
  @emptyStringToUndefined()
  @IsUUID()
  @IsOptional()
  template_id?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => OfferDetailsDto)
  details?: OfferDetailsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => OfferCompensationDto)
  compensation?: OfferCompensationDto;

  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  policy_ids?: string[];
}

export class SendOfferDto {
  @IsString()
  @IsOptional()
  change_summary?: string;
}

export class WithdrawOfferDto {
  @IsString()
  @IsNotEmpty()
  reason: string;
}

export class ExtendExpiryDto {
  @IsNumber()
  @Min(1)
  extra_days: number;
}

export class FilterOffersDto extends PaginationDto {
  @IsOptional()
  offer_status?: string;

  @IsUUID()
  @IsOptional()
  candidate_id?: string;
}

export class BulkSendOffersDto {
  @IsArray()
  @IsUUID('4', { each: true })
  offer_ids: string[];
}

export class LinkEmployeeDto {
  @IsUUID()
  @IsNotEmpty()
  employee_id: string;
}
