import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsDateString,
  MaxLength,
  IsUUID,
  IsEnum,
  IsInt,
} from 'class-validator';
import { EmergencyRelation, ExitType } from '../enums/user.enum';

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
  additionalDetail?: string;
}

export class AddExperienceDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  occupation: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  company: string;

  @IsString()
  @IsOptional()
  summary?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  duration?: string;
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
}
