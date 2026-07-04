import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class SubscribePushDto {
  @ApiProperty({ description: 'Push subscription endpoint URL' })
  @IsString()
  @IsNotEmpty()
  endpoint: string;

  @ApiProperty({ description: 'p256dh encryption key' })
  @IsString()
  @IsNotEmpty()
  p256dh: string;

  @ApiProperty({ description: 'Auth secret' })
  @IsString()
  @IsNotEmpty()
  auth: string;

  @ApiPropertyOptional({ description: 'Platform identifier', default: 'web' })
  @IsString()
  @IsOptional()
  platform?: string;
}

export class UnsubscribePushDto {
  @ApiProperty({ description: 'Push subscription endpoint URL to remove' })
  @IsString()
  @IsNotEmpty()
  endpoint: string;
}
