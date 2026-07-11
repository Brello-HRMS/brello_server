import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsBoolean,
  IsArray,
  Length,
  ArrayMaxSize,
} from 'class-validator';

export class CreateLetterTemplateDto {
  @IsUUID()
  category_id: string;

  @IsString()
  @IsNotEmpty({ message: 'Template name is required' })
  @Length(2, 150)
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  heading?: string;

  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(30)
  @IsOptional()
  paragraphs?: string[];

  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(30)
  @IsOptional()
  bullet_list?: string[];

  @IsBoolean()
  @IsOptional()
  include_salary_table?: boolean;

  @IsUUID()
  @IsOptional()
  signatory_id?: string;
}

export class UpdateLetterTemplateDto {
  @IsUUID()
  @IsOptional()
  category_id?: string;

  @IsString()
  @IsOptional()
  @Length(2, 150)
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  heading?: string;

  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(30)
  @IsOptional()
  paragraphs?: string[];

  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(30)
  @IsOptional()
  bullet_list?: string[];

  @IsBoolean()
  @IsOptional()
  include_salary_table?: boolean;

  @IsUUID()
  @IsOptional()
  signatory_id?: string;
}

export class PreviewLetterTemplateDto {
  @IsUUID()
  @IsOptional()
  employee_id?: string;
}
