import { IsString, IsNotEmpty, IsOptional, Length } from 'class-validator';

export class CreateLetterCategoryDto {
  @IsString()
  @IsNotEmpty({ message: 'Category name is required' })
  @Length(2, 100, { message: 'Name must be between 2 and 100 characters' })
  name: string;

  @IsString()
  @IsOptional()
  description?: string;
}

export class UpdateLetterCategoryDto {
  @IsString()
  @IsOptional()
  @Length(2, 100, { message: 'Name must be between 2 and 100 characters' })
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;
}
