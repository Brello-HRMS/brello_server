import { IsString, IsNotEmpty, IsOptional, IsEnum, Length, Matches } from 'class-validator';
import { Status } from '../../../common/enums';

export class CreatePlatformDepartmentDto {
  @IsString()
  @IsNotEmpty()
  @Length(2, 255)
  name: string;

  @IsString()
  @IsNotEmpty()
  @Length(1, 50)
  @Matches(/^[A-Z0-9_-]+$/, { message: 'Code must be uppercase alphanumeric (A-Z, 0-9, -, _)' })
  code: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(Status)
  @IsOptional()
  status?: Status;
}
