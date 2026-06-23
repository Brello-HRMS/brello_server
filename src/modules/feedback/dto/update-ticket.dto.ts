import { IsEnum, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';
import { FeedbackStatus } from '../enums/feedback-status.enum';
import { FeedbackPriority } from '../enums/feedback-priority.enum';

export class UpdateTicketDto {
  @IsOptional()
  @IsEnum(FeedbackStatus)
  status?: FeedbackStatus;

  @IsOptional()
  @IsEnum(FeedbackPriority)
  priority?: FeedbackPriority;

  @ValidateIf((o) => !!o.status)
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
