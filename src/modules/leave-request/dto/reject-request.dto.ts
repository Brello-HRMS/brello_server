import { IsString, Length } from 'class-validator';

export class RejectRequestDto {
  @IsString()
  @Length(5, 500)
  rejection_reason: string;
}
