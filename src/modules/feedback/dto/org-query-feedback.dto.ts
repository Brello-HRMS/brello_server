import { IsOptional, IsEnum, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { FeedbackType } from '../enums/feedback-type.enum';
import { FeedbackCategory } from '../enums/feedback-category.enum';
import { FeedbackStatus } from '../enums/feedback-status.enum';

export class OrgQueryFeedbackDto {
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
