import { BadRequestException } from '@nestjs/common';
import { Document } from '../entities/document.entity';
import {
  DocumentStorageStrategy,
  RetrievedFile,
} from './document-storage-strategy.interface';

export class UnsupportedStorageStrategy implements DocumentStorageStrategy {
  constructor(private readonly provider: string) {}

  private fail(): never {
    throw new BadRequestException(
      `Storage provider "${this.provider}" is not implemented`,
    );
  }

  async getUploadTarget(): Promise<string> {
    this.fail();
  }

  async store(): Promise<Partial<Document>> {
    this.fail();
  }

  async finalizeUpload(): Promise<Partial<Document>> {
    this.fail();
  }

  buildViewUrl(): string {
    this.fail();
  }

  async getSignedDownloadUrl(): Promise<string> {
    this.fail();
  }

  async retrieve(): Promise<RetrievedFile> {
    this.fail();
  }

  async purge(): Promise<Partial<Document>> {
    this.fail();
  }
}
