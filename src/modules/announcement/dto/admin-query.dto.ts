import { IsOptional, IsEnum, IsString, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { AnnouncementStatus, AnnouncementPriority } from '../enums/announcement.enum';

export class AdminAnnouncementQueryDto {
  @IsOptional()
  @IsEnum(AnnouncementStatus)
  status?: AnnouncementStatus;

  @IsOptional()
  @IsEnum(AnnouncementPriority)
  priority?: AnnouncementPriority;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;
}
