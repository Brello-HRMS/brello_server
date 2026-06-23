import {
  IsEnum,
  IsNotEmpty,
  IsString,
  MaxLength,
  IsOptional,
  IsArray,
  ValidateNested,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';
import { FeedbackType } from '../enums/feedback-type.enum';
import { FeedbackCategory } from '../enums/feedback-category.enum';

class AttachmentDto {
  @IsUUID('4')
  document_id: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  mime_type: string;
}

export class CreateFeedbackTicketDto {
  @IsEnum(FeedbackType)
  type: FeedbackType;

  @IsEnum(FeedbackCategory)
  category: FeedbackCategory;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  ticket_description: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  affected_module?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttachmentDto)
  attachments?: AttachmentDto[];
}
