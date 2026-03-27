import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsDateString,
  IsDate,
} from 'class-validator';
import {
  ProjectStatus,
  ProjectPriority,
  ProjectType,
} from '../enums/project-enums';

export class CreateProjectDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsEnum(ProjectType)
  project_type: ProjectType;

  @IsOptional()
  @IsEnum(ProjectStatus)
  project_status?: ProjectStatus = ProjectStatus.DRAFT;

  @IsNotEmpty()
  @IsEnum(ProjectPriority)
  priority: ProjectPriority;

  @IsOptional()
  @IsDate()
  start_date?: Date | undefined;

  @IsOptional()
  @IsDate()
  end_date?: Date | undefined;

  @IsOptional()
  @IsString()
  description?: string;
}
