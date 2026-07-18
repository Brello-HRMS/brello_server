import { Injectable } from '@nestjs/common';
import { StorageProvider } from '../enums/document.enum';
import { DocumentStorageStrategy } from './document-storage-strategy.interface';
import { S3StorageStrategy } from './s3-storage.strategy';
import { DatabaseStorageStrategy } from './database-storage.strategy';
import { UnsupportedStorageStrategy } from './unsupported-storage.strategy';

@Injectable()
export class StorageStrategyFactory {
  constructor(
    private readonly s3Strategy: S3StorageStrategy,
    private readonly databaseStrategy: DatabaseStorageStrategy,
  ) {}

  resolve(provider: StorageProvider): DocumentStorageStrategy {
    switch (provider) {
      case StorageProvider.S3:
        return this.s3Strategy;
      case StorageProvider.DATABASE:
        return this.databaseStrategy;
      default:
        return new UnsupportedStorageStrategy(provider);
    }
  }
}
