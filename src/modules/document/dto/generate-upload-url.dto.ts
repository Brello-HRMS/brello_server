import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Max,
} from 'class-validator';
import { FolderType } from '../enums/document.enum';
import { MAX_UPLOAD_SIZE_BYTES } from '../constants/document.constants';

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
  @IsPositive()
  @Max(MAX_UPLOAD_SIZE_BYTES)
  size: number;
}
