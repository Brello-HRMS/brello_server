import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class CreateIndustryTypeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;
}
