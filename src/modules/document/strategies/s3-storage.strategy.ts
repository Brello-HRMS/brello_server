import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Document } from '../entities/document.entity';
import { StorageService } from '../services/storage.service';
import { MAX_UPLOAD_SIZE_BYTES } from '../constants/document.constants';
import {
  DocumentStorageStrategy,
  RetrievedFile,
  StoreParams,
  UploadTargetParams,
} from './document-storage-strategy.interface';

@Injectable()
export class S3StorageStrategy implements DocumentStorageStrategy {
  constructor(
    private readonly storageService: StorageService,
    private readonly configService: ConfigService,
  ) {}

  async getUploadTarget({
    objectKey,
    mimeType,
  }: UploadTargetParams): Promise<string> {
    return this.storageService.generatePresignedUploadUrl(objectKey, mimeType);
  }

  async store({ objectKey, buffer, mimeType }: StoreParams): Promise<Partial<Document>> {
    await this.storageService.uploadFile(buffer, objectKey, mimeType);
    return {};
  }

  async finalizeUpload(document: Document): Promise<Partial<Document>> {
    const metadata = await this.storageService.headObject(document.object_key);
    if (!metadata) {
      throw new BadRequestException(
        'Upload not found in storage; retry the upload before confirming',
      );
    }
    if (metadata.size > MAX_UPLOAD_SIZE_BYTES) {
      await this.storageService.deleteFile(document.object_key).catch(() => undefined);
      throw new BadRequestException(
        `Uploaded file exceeds the maximum allowed size of ${MAX_UPLOAD_SIZE_BYTES} bytes`,
      );
    }
    return { size: metadata.size } as Partial<Document>;
  }

  buildViewUrl(document: Document): string {
    const region = this.configService.get<string>('aws.region') || 'us-east-1';
    return `https://${document.bucket}.s3.${region}.amazonaws.com/${document.object_key}`;
  }

  async getSignedDownloadUrl(document: Document): Promise<string> {
    return this.storageService.generatePresignedDownloadUrl(document.object_key);
  }

  async retrieve(): Promise<RetrievedFile> {
    throw new BadRequestException('Document is not stored in the database');
  }

  async purge(document: Document): Promise<Partial<Document>> {
    await this.storageService.deleteFile(document.object_key);
    return {};
  }
}
