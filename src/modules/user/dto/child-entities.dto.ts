import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsDateString,
  MaxLength,
  IsUUID,
  IsEnum,
  IsInt,
  Length,
  IsBoolean,
} from 'class-validator';
import {
  EmergencyRelation,
  ExitType,
  TaxRegime,
  DocumentCategory,
} from '../enums/user.enum';

export class AddEducationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  schoolName: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  degree: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  fieldOfStudy: string;

  @IsDateString()
  @IsNotEmpty()
  completionDate: string;

  @IsString()
  @IsOptional()
  @Length(4, 4)
  completionYear?: string;

  @IsString()
  @IsOptional()
  additionalDetail?: string;
}

export class AddExperienceDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  designation: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  company: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsDateString()
  @IsNotEmpty()
  fromDate: string;

  @IsDateString()
  @IsOptional()
  toDate?: string;

  @IsBoolean()
  @IsOptional()
  isCurrent?: boolean;
}

export class AddAssetDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;
}

export class UpdateGovInfoDto {
  @IsString()
  @IsOptional()
  @MaxLength(100)
  uan?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  aadhaar?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  pan?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  esi?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  passport?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  drivingLicence?: string;
}

export class UpdateBankInfoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  accountNumber: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  ifscCode: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  bankName: string;
}

export class AddDocumentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @IsUUID()
  @IsNotEmpty()
  docId: string;

  @IsEnum(DocumentCategory)
  @IsOptional()
  category?: DocumentCategory;
}

export class UpdateEmergencyContactDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  email?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  phone: string;

  @IsEnum(EmergencyRelation)
  @IsNotEmpty()
  relation: EmergencyRelation;
}

export class EmployeeExitDto {
  @IsEnum(ExitType)
  @IsNotEmpty()
  exitType: ExitType;

  @IsDateString()
  @IsOptional()
  lastWorkingDay?: string;

  @IsString()
  @IsOptional()
  exitReason?: string;
}

export class InitiateOffboardingDto {
  @IsEnum(ExitType)
  @IsNotEmpty()
  exit_type: ExitType;

  @IsString()
  @IsNotEmpty()
  reason: string;

  @IsDateString()
  @IsNotEmpty()
  last_working_day: string;

  @IsInt()
  @IsOptional()
  notice_period?: number;

  @IsUUID()
  @IsOptional()
  handover_to_user_id?: string;

  @IsOptional()
  @IsString({ each: true })
  assets_to_recover?: string[];

  @IsBoolean()
  @IsOptional()
  schedule_exit_interview?: boolean;
}

export class UpdateOffboardingDto {
  @IsString()
  @IsOptional()
  reason?: string;

  @IsDateString()
  @IsOptional()
  last_working_day?: string;

  @IsInt()
  @IsOptional()
  notice_period?: number;
}

export class UploadDocumentsDto {
  @IsNotEmpty()
  documents: AddDocumentDto[];
}

export class UpdatePayrollInfoDto {
  @IsOptional()
  bank_info?: UpdateBankInfoDto;

  @IsOptional()
  gov_info?: UpdateGovInfoDto;

  @IsString()
  @IsOptional()
  annualCtc?: string;

  @IsString()
  @IsOptional()
  monthlyGross?: string;

  @IsString()
  @IsOptional()
  allowances?: string;

  @IsString()
  @IsOptional()
  bonus?: string;

  @IsString()
  @IsOptional()
  totalCtc?: string;

  @IsEnum(TaxRegime)
  @IsOptional()
  taxRegime?: TaxRegime;
}
