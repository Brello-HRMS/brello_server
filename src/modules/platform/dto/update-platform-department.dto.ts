import { IsString, IsOptional, IsEnum, Length } from 'class-validator';
import { Status } from '../../../common/enums';

export class UpdatePlatformDepartmentDto {
  @IsString()
  @IsOptional()
  @Length(2, 255)
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(Status)
  @IsOptional()
  status?: Status;
}
