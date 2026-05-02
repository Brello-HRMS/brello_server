import { IsString, IsNotEmpty, IsNumber, IsPositive, IsDateString, IsArray, IsUUID, MinLength, MaxLength, IsOptional } from 'class-validator';

export class CreateReimbursementDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(255)
  title: string;

  @IsString()
  @IsOptional()
  expense_description?: string;

  @IsDateString()
  @IsNotEmpty()
  expense_date: string;

  @IsNumber()
  @IsPositive()
  amount: number;

  @IsArray()
  @IsUUID('4', { each: true })
  document_ids: string[];
}
