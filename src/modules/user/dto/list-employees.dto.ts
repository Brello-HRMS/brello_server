import { IsOptional, IsEnum, IsString, IsUUID } from 'class-validator';
import { Status } from '../../../common/enums';
import { ListQueryDto } from '../../../common/dto/pagination.dto';

export class ListEmployeesDto extends ListQueryDto {
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsUUID()
  designationId?: string;

  @IsOptional()
  @IsEnum(Status)
  status?: Status;
}
