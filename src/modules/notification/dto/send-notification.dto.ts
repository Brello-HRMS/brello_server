import {
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationType } from '../../../common/enums/notification-type.enum';

export class SendNotificationDto {
  @ApiPropertyOptional({ description: 'Target user ID (required for IN_APP and PUSH)', format: 'uuid' })
  @IsUUID()
  @IsOptional()
  user_id?: string;

  @ApiPropertyOptional({ description: 'Recipient email address (required when type is EMAIL)' })
  @ValidateIf((o) => o.type === NotificationType.EMAIL)
  @IsString()
  @IsNotEmpty({ message: 'target_email is required when type is EMAIL' })
  target_email?: string;

  @ApiProperty({ description: 'Notification title', example: 'Leave request approved' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ description: 'Notification body text', example: 'Your leave from Jan 10–12 has been approved.' })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiProperty({ description: 'Delivery channel', enum: NotificationType })
  @IsEnum(NotificationType)
  @IsNotEmpty()
  type: NotificationType;

  @ApiPropertyOptional({ description: 'Arbitrary metadata (event_type, requires_action, etc.)', type: Object })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Notification event type for preference gating (e.g. leave.approved)', example: 'leave.approved' })
  @IsString()
  @IsOptional()
  event_type?: string;

  @ApiPropertyOptional({
    description:
      'Organization the email is sent on behalf of. When this org has an active Gmail integration, EMAIL notifications are sent from that account; otherwise the default provider is used.',
    format: 'uuid',
  })
  @IsUUID()
  @IsOptional()
  organization_id?: string;
}
