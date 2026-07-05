import { IsString, IsOptional, IsUUID, Length } from 'class-validator';

export class UpdateLetterSettingsDto {
  @IsString()
  @IsOptional()
  @Length(1, 20)
  letter_prefix?: string;

  @IsUUID()
  @IsOptional()
  default_signatory_id?: string;

  @IsString()
  @IsOptional()
  @Length(1, 30)
  date_format?: string;
}
