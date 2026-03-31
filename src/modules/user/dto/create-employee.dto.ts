import {
  IsString,
  IsNotEmpty,
  IsEmail,
  IsOptional,
  Length,
  Matches,
  IsUUID,
  ValidateNested,
  IsEnum,
  IsDateString,
  IsInt,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  UserType,
  MaritalStatus,
  Gender,
  EmploymentType,
  WorkLocation,
  BloodGroup,
} from '../enums/user.enum';

export class CreateUserProfileDto {
  @IsString()
  @IsOptional()
  employeeId?: string;

  @IsEnum(UserType)
  @IsOptional()
  type?: UserType;

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

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  emergencyContact?: string;
}

export class CreateEmployeeDto {
  @IsString()
  @IsNotEmpty({ message: 'First name is required' })
  @Length(2, 100)
  firstName: string;

  @IsString()
  @IsOptional()
  @Length(2, 100)
  middleName?: string;

  @IsString()
  @IsNotEmpty({ message: 'Last name is required' })
  @Length(2, 100)
  lastName: string;

  @IsEmail({}, { message: 'Email must be a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @IsString()
  @IsOptional()
  @Matches(/^\+?[1-9]\d{1,14}$/, {
    message: 'Valid E.164 phone number required',
  })
  phone?: string;

  @IsString()
  @IsOptional()
  @Length(8, 100)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
    message: 'Password must be strong',
  })
  password?: string;

  @IsUUID('4')
  @IsOptional()
  reportsTo?: string;

  @IsUUID('4')
  @IsOptional()
  departmentId?: string;

  @IsUUID('4')
  @IsOptional()
  designationId?: string;

  // The nested profile
  @ValidateNested()
  @Type(() => CreateUserProfileDto)
  @IsOptional()
  profile?: CreateUserProfileDto;

  // Tenant identifiers injected from JWT, not from body typically, but for strictness:
  @IsUUID('4')
  @IsOptional() // Handled by auth guard usually, but keeping it available
  enterprise_id?: string;

  @IsUUID('4')
  @IsOptional()
  organization_id?: string;
}
