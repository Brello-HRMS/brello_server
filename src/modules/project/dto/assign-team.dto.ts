import {
  IsArray,
  IsUUID,
  IsString,
  IsNotEmpty,
  IsBoolean,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ProjectMemberDto {
  @IsNotEmpty()
  @IsUUID()
  user_id: string;

  @IsNotEmpty()
  @IsString()
  role: string;

  @IsOptional()
  @IsBoolean()
  is_lead?: boolean;
}

export class AssignTeamDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProjectMemberDto)
  members: ProjectMemberDto[];
}
