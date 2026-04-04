import { IsNotEmpty, IsUUID } from 'class-validator';

export class UploadContractDto {
  @IsUUID()
  @IsNotEmpty()
  documentId: string;
}
