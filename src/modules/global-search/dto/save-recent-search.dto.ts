import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SaveRecentSearchDto {
  @IsString()
  @IsOptional()
  @MaxLength(200)
  query?: string;

  @IsString()
  @IsOptional()
  entity_id?: string;

  @IsString()
  @IsOptional()
  entity_type?: string;

  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  route?: string;
}
