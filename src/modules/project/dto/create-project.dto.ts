import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsDateString,
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
  status?: ProjectStatus = ProjectStatus.DRAFT;

  @IsNotEmpty()
  @IsEnum(ProjectPriority)
  priority: ProjectPriority;

  @IsOptional()
  @IsDateString()
  start_date?: string;

  @IsOptional()
  @IsDateString()
  end_date?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
