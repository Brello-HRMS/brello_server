import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { FolderType } from '../enums/document.enum';

export class GenerateUploadUrlDto {
  @IsEnum(FolderType)
  @IsNotEmpty()
  folderType: FolderType;

  @IsUUID()
  @IsOptional()
  enterpriseId?: string;

  @IsUUID()
  @IsOptional()
  organizationId?: string;

  @IsUUID()
  @IsOptional()
  employeeId?: string;

  @IsString()
  @IsNotEmpty()
  originalName: string;

  @IsString()
  @IsNotEmpty()
  mimeType: string;

  @IsNumber()
  @IsNotEmpty()
  size: number;
}
