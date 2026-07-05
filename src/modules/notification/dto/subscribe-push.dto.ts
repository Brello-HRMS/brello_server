import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class SubscribePushDto {
  @ApiProperty({ description: 'Push subscription endpoint URL or FCM token' })
  @IsString()
  @IsNotEmpty()
  endpoint: string;

  @ApiPropertyOptional({ description: 'p256dh encryption key (Web Push only, omit for FCM)' })
  @IsString()
  @IsOptional()
  p256dh?: string;

  @ApiPropertyOptional({ description: 'Auth secret (Web Push only, omit for FCM)' })
  @IsString()
  @IsOptional()
  auth?: string;

  @ApiPropertyOptional({ description: 'Platform identifier', enum: ['web', 'android', 'ios'], default: 'web' })
  @IsString()
  @IsOptional()
  platform?: string;
}

export class UnsubscribePushDto {
  @ApiProperty({ description: 'Push subscription endpoint URL or FCM token to remove' })
  @IsString()
  @IsNotEmpty()
  endpoint: string;
}
