import {
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  ValidateIf,
} from 'class-validator';
import { NotificationType } from '../../../common/enums/notification-type.enum';

export class SendNotificationDto {
  /**
   * For IN_APP or default behavior. If sending an email and no target_email is provided,
   * the user's email might be looked up instead (depending on service logic).
   */
  @IsUUID()
  @IsOptional()
  user_id?: string;

  /**
   * Specifically forEMAIL routing if skipping user lookup
   */
  @ValidateIf((o) => o.type === NotificationType.EMAIL)
  @IsString()
  @IsNotEmpty({ message: 'Target email is required when type is EMAIL' })
  target_email?: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  message: string;

  @IsEnum(NotificationType)
  @IsNotEmpty()
  type: NotificationType;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}
