import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Document } from '../entities/document.entity';
import { isImageFolderType } from '../enums/document.enum';
import {
  DocumentStorageStrategy,
  RetrievedFile,
  StoreParams,
  UploadTargetParams,
} from './document-storage-strategy.interface';
import {
  appendSignatureToPath,
  signDocumentView,
} from '../utils/document-signature.util';

@Injectable()
export class DatabaseStorageStrategy implements DocumentStorageStrategy {
  constructor(private readonly configService: ConfigService) {}

  async getUploadTarget({ documentId }: UploadTargetParams): Promise<string> {
    return `/api/v1/documents/${documentId}/upload`;
  }

  async store({ buffer }: StoreParams): Promise<Partial<Document>> {
    return { file_data: buffer } as Partial<Document>;
  }

  async finalizeUpload(): Promise<Partial<Document>> {
    return {};
  }

  buildViewUrl(document: Document): string {
    if (!isImageFolderType(document.folder_type)) {
      return `/api/v1/documents/${document.id}/download`;
    }

    const secret = this.configService.get<string>('auth.JWT_SECRET');
    if (!secret) {
      throw new Error('auth.JWT_SECRET is not configured');
    }
    const signed = signDocumentView(document.id, secret);
    return appendSignatureToPath(
      `/api/v1/documents/${document.id}/view`,
      signed,
    );
  }

  async getSignedDownloadUrl(document: Document): Promise<string> {
    return this.buildViewUrl(document);
  }

  async retrieve(document: Document): Promise<RetrievedFile> {
    return {
      buffer: document.file_data,
      mimeType: document.mime_type,
      fileName: document.original_name,
    };
  }

  async purge(): Promise<Partial<Document>> {
    return { file_data: null } as unknown as Partial<Document>;
  }
}
