import { IsString, IsNotEmpty, MaxLength, IsOptional, IsIn } from 'class-validator';
import { DOCUMENT_TYPES } from '../entities/letter-category.entity';
import type { DocumentType } from '../entities/letter-category.entity';

export class CreateLetterCategoryDto {
  @IsString()
  @IsNotEmpty({ message: 'Category name is required' })
  @MaxLength(255)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsIn(DOCUMENT_TYPES, { message: 'Invalid document type' })
  document_type: DocumentType;
}

export class UpdateLetterCategoryDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
