import { ConfigService } from '@nestjs/config';

export function calculateSessionExpiration(configService: ConfigService): Date {
  const days = configService.get<number>('session.expirationDays', 7);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + days);
  return expiresAt;
}

export function calculateOtpExpiration(configService: ConfigService): Date {
  const minutes = configService.get<number>('otp.expirationMinutes', 10);
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + minutes);
  return expiresAt;
}
