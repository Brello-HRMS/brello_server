import { IsOptional, IsEnum, IsUUID, IsString } from 'class-validator';
import { ListQueryDto } from '../../../common/dto/pagination.dto';
import { ProjectStatus, ProjectPriority } from '../enums/project-enums';

export class ListProjectsDto extends ListQueryDto {
  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;

  @IsOptional()
  @IsEnum(ProjectStatus)
  project_status?: ProjectStatus;

  @IsOptional()
  @IsEnum(ProjectPriority)
  priority?: ProjectPriority;

  @IsOptional()
  @IsUUID()
  client_id?: string;
}
