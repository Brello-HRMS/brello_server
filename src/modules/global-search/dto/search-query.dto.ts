import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SearchQueryDto {
  @IsString()
  @IsOptional()
  @MaxLength(200)
  q?: string;
}
