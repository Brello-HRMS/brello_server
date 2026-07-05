import { IsBoolean, IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { NotificationType } from '../../../common/enums/notification-type.enum';

export class UpdatePreferenceDto {
  @ApiProperty({ enum: NotificationType, description: 'Notification channel' })
  @IsEnum(NotificationType)
  channel: NotificationType;

  @ApiProperty({ description: 'Event type identifier', example: 'leave.approved' })
  @IsString()
  @IsNotEmpty()
  event_type: string;

  @ApiProperty({ description: 'Whether this notification is enabled' })
  @IsBoolean()
  enabled: boolean;
}
