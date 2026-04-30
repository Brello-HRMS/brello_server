import { IsString, IsNumber, IsPositive, IsDateString, IsOptional, IsInt, Min, IsArray, IsUUID, MaxLength } from 'class-validator';

export class UpdateReimbursementDto {
  @IsString()
  @IsOptional()
  @MaxLength(255)
  title?: string;

  @IsString()
  @IsOptional()
  expense_description?: string;

  @IsDateString()
  @IsOptional()
  expense_date?: string;

  @IsNumber()
  @IsPositive()
  @IsOptional()
  amount?: number;

  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  add_document_ids?: string[];

  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  remove_document_ids?: string[];

  @IsInt()
  @Min(1)
  version: number;
}
