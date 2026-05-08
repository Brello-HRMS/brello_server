import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsBoolean,
  IsArray,
  ValidateNested,
  IsDateString,
  MaxLength,
  ValidateIf,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  AnnouncementPriority,
  AnnouncementPublishType,
  AnnouncementTargetType,
} from '../enums/announcement.enum';

export class AttachmentDto {
  @IsString()
  @IsNotEmpty()
  file_name: string;

  @IsString()
  @IsNotEmpty()
  file_url: string;

  @IsOptional()
  file_size?: number;

  @IsOptional()
  @IsString()
  mime_type?: string;
}

export class AudienceDto {
  @IsEnum(AnnouncementTargetType)
  type: AnnouncementTargetType;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  department_ids?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  location_ids?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  employee_ids?: string[];
}

export class CreateAnnouncementDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @IsString()
  @IsNotEmpty()
  description_html: string;

  @IsOptional()
  @IsEnum(AnnouncementPriority)
  priority?: AnnouncementPriority;

  @IsEnum(AnnouncementPublishType)
  publish_type: AnnouncementPublishType;

  @ValidateIf((o) => o.publish_type === AnnouncementPublishType.SCHEDULED)
  @IsNotEmpty({ message: 'scheduled_at is required when publish_type is SCHEDULED' })
  @IsDateString()
  scheduled_at?: string;

  @ValidateNested()
  @Type(() => AudienceDto)
  audience: AudienceDto;

  @IsOptional()
  @IsBoolean()
  send_push?: boolean;

  @IsOptional()
  @IsBoolean()
  send_email?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => AttachmentDto)
  attachments?: AttachmentDto[];
}
