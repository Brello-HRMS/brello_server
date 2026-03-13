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
}
