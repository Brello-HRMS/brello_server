import { IsString, IsOptional, IsEnum, Length } from 'class-validator';
import { Status } from '../../../common/enums';

export class UpdatePlatformDesignationDto {
  @IsString()
  @IsOptional()
  @Length(2, 255)
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(Status)
  @IsOptional()
  status?: Status;
}
