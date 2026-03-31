import {
  IsString,
  IsOptional,
  Length,
  Matches,
  IsUUID,
  IsEnum,
  IsDateString,
  IsInt,
} from 'class-validator';
import {
  MaritalStatus,
  Gender,
  EmploymentType,
  WorkLocation,
  BloodGroup,
  TaxRegime,
} from '../enums/user.enum';

export class UpdateEmployeeBasicDto {
  @IsString()
  @IsOptional()
  @Length(2, 100)
  firstName?: string;

  @IsString()
  @IsOptional()
  @Length(2, 100)
  middleName?: string;

  @IsString()
  @IsOptional()
  @Length(2, 100)
  lastName?: string;

  @IsString()
  @IsOptional()
  @Matches(/^\+?[1-9]\d{1,14}$/, {
    message: 'Valid E.164 phone number required',
  })
  phone?: string;

  @IsUUID('4')
  @IsOptional()
  reportsTo?: string;

  @IsUUID('4')
  @IsOptional()
  departmentId?: string;

  @IsUUID('4')
  @IsOptional()
  designationId?: string;

  @IsString()
  @IsOptional()
  employeeId?: string;
}

export class UpdateEmployeeProfileDto {
  @IsDateString()
  @IsOptional()
  dob?: string;

  @IsEnum(Gender)
  @IsOptional()
  gender?: Gender;

  @IsEnum(MaritalStatus)
  @IsOptional()
  maritalStatus?: MaritalStatus;

  @IsDateString()
  @IsOptional()
  joiningDate?: string;

  @IsDateString()
  @IsOptional()
  employmentDate?: string;

  @IsEnum(EmploymentType)
  @IsOptional()
  employmentType?: EmploymentType;

  @IsEnum(WorkLocation)
  @IsOptional()
  workLocation?: WorkLocation;

  @IsEnum(BloodGroup)
  @IsOptional()
  bloodGroup?: BloodGroup;

  @IsInt()
  @IsOptional()
  noticePeriod?: number;

  @IsString()
  @IsOptional()
  currentSalary?: string;

  @IsString()
  @IsOptional()
  presentAddress?: string;

  @IsString()
  @IsOptional()
  permanentAddress?: string;

  @IsString()
  @IsOptional()
  probationPeriod?: string;

  @IsString()
  @IsOptional()
  notes?: string;

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

export class UpdateSystemAccessDto {
  @IsUUID('4')
  @IsOptional()
  roleId?: string;

  @IsString({ each: true })
  @IsOptional()
  assignedAssets?: string[];
}
