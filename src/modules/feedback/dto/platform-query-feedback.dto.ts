import { IsOptional, IsEnum, IsUUID, IsDateString, IsInt, Min, Max, IsString, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { FeedbackType } from '../enums/feedback-type.enum';
import { FeedbackCategory } from '../enums/feedback-category.enum';
import { FeedbackStatus } from '../enums/feedback-status.enum';
import { FeedbackPriority } from '../enums/feedback-priority.enum';

export class PlatformQueryFeedbackDto {
  @IsOptional()
  @IsUUID('4')
  organization_id?: string;

  @IsOptional()
  @IsUUID('4')
  enterprise_id?: string;

  @IsOptional()
  @IsEnum(FeedbackType)
  type?: FeedbackType;

  @IsOptional()
  @IsEnum(FeedbackCategory)
  category?: FeedbackCategory;

  @IsOptional()
  @IsEnum(FeedbackStatus)
  status?: FeedbackStatus;

  @IsOptional()
  @IsEnum(FeedbackPriority)
  priority?: FeedbackPriority;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  affected_module?: string;

  @IsOptional()
  @IsDateString()
  from_date?: string;

  @IsOptional()
  @IsDateString()
  to_date?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
