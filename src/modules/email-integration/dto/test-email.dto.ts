import { IsEmail, IsOptional } from 'class-validator';

/**
 * Payload for the "send a test email" endpoint. When `to` is omitted the test
 * email is sent to the connected account itself.
 */
export class TestEmailDto {
  @IsOptional()
  @IsEmail({}, { message: 'to must be a valid email address' })
  to?: string;
}
