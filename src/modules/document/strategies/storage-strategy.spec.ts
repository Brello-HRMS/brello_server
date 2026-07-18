import { BadRequestException } from '@nestjs/common';
import { DatabaseStorageStrategy } from './database-storage.strategy';
import { S3StorageStrategy } from './s3-storage.strategy';
import { UnsupportedStorageStrategy } from './unsupported-storage.strategy';
import { StorageStrategyFactory } from './storage-strategy.factory';
import { DocumentStorageStrategy } from './document-storage-strategy.interface';
import { FolderType, StorageProvider } from '../enums/document.enum';
import { MAX_UPLOAD_SIZE_BYTES } from '../constants/document.constants';
import { Document } from '../entities/document.entity';

function makeDocument(overrides: Partial<Document> = {}): Document {
  return {
    id: 'doc1',
    bucket: 'bucket',
    object_key: 'ent1/org1/documents/uuid.png',
    folder_type: FolderType.ORGANIZATION_DOCUMENT,
    mime_type: 'image/png',
    original_name: 'file.png',
    file_data: Buffer.from('hello'),
    ...overrides,
  } as Document;
}

describe('DatabaseStorageStrategy', () => {
  let configService: any;
  let strategy: DocumentStorageStrategy;

  beforeEach(() => {
    configService = {
      get: jest.fn((key: string) =>
        key === 'auth.JWT_SECRET' ? 'test-secret' : undefined,
      ),
    };
    strategy = new DatabaseStorageStrategy(configService);
  });

  it('points the upload target at the dedicated DB upload endpoint', async () => {
    const url = await strategy.getUploadTarget({
      documentId: 'doc1',
      objectKey: 'k',
      mimeType: 'image/png',
    });
    expect(url).toBe('/api/v1/documents/doc1/upload');
  });

  it('stores the buffer as file_data', async () => {
    const buffer = Buffer.from('bytes');
    const result = await strategy.store({
      objectKey: 'k',
      buffer,
      mimeType: 'image/png',
    });
    expect(result).toEqual({ file_data: buffer });
  });

  it('routes non-image documents to the download endpoint', () => {
    const url = strategy.buildViewUrl(
      makeDocument({ folder_type: FolderType.EMPLOYEE_DOCUMENT }),
    );
    expect(url).toBe('/api/v1/documents/doc1/download');
  });

  it('returns a signed bearer URL for image documents', () => {
    const url = strategy.buildViewUrl(
      makeDocument({ folder_type: FolderType.EMPLOYEE_IMAGE }),
    );
    expect(url).toContain('/api/v1/documents/doc1/view?sig=');
  });

  it('throws when JWT_SECRET is not configured for an image document', () => {
    configService.get.mockReturnValue(undefined);
    expect(() =>
      strategy.buildViewUrl(makeDocument({ folder_type: FolderType.EMPLOYEE_IMAGE })),
    ).toThrow();
  });

  it('is a no-op on finalizeUpload (already verified at upload time)', async () => {
    expect(await strategy.finalizeUpload(makeDocument())).toEqual({});
  });

  it('retrieves the stored buffer', async () => {
    const document = makeDocument();
    await expect(strategy.retrieve(document)).resolves.toEqual({
      buffer: document.file_data,
      mimeType: document.mime_type,
      fileName: document.original_name,
    });
  });

  it('clears file_data on purge', async () => {
    await expect(strategy.purge(makeDocument())).resolves.toEqual({
      file_data: null,
    });
  });
});

describe('S3StorageStrategy', () => {
  let storageService: any;
  let configService: any;
  let strategy: DocumentStorageStrategy;

  beforeEach(() => {
    storageService = {
      generatePresignedUploadUrl: jest.fn(() => Promise.resolve('presigned-upload-url')),
      generatePresignedDownloadUrl: jest.fn(() => Promise.resolve('presigned-download-url')),
      uploadFile: jest.fn(() => Promise.resolve()),
      deleteFile: jest.fn(() => Promise.resolve()),
      headObject: jest.fn(),
    };
    configService = { get: jest.fn(() => undefined) };
    strategy = new S3StorageStrategy(storageService, configService);
  });

  it('delegates the upload target to a presigned upload URL', async () => {
    const url = await strategy.getUploadTarget({
      documentId: 'doc1',
      objectKey: 'k',
      mimeType: 'image/png',
    });
    expect(url).toBe('presigned-upload-url');
    expect(storageService.generatePresignedUploadUrl).toHaveBeenCalledWith('k', 'image/png');
  });

  it('uploads the buffer to S3 and stores no local fields', async () => {
    const buffer = Buffer.from('bytes');
    const result = await strategy.store({ objectKey: 'k', buffer, mimeType: 'image/png' });
    expect(storageService.uploadFile).toHaveBeenCalledWith(buffer, 'k', 'image/png');
    expect(result).toEqual({});
  });

  it('builds a direct public S3 object URL', () => {
    const url = strategy.buildViewUrl(makeDocument());
    expect(url).toBe('https://bucket.s3.us-east-1.amazonaws.com/ent1/org1/documents/uuid.png');
  });

  it('delegates signed download URLs to the presigned download URL', async () => {
    const url = await strategy.getSignedDownloadUrl(makeDocument());
    expect(url).toBe('presigned-download-url');
  });

  it('refuses to serve raw bytes (S3-backed documents never pass through our server)', async () => {
    await expect(strategy.retrieve(makeDocument())).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('deletes the S3 object on purge', async () => {
    const document = makeDocument();
    await expect(strategy.purge(document)).resolves.toEqual({});
    expect(storageService.deleteFile).toHaveBeenCalledWith(document.object_key);
  });

  describe('finalizeUpload', () => {
    it('rejects when the object was never actually uploaded', async () => {
      storageService.headObject.mockResolvedValue(null);
      await expect(strategy.finalizeUpload(makeDocument())).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rejects and deletes an oversized object', async () => {
      storageService.headObject.mockResolvedValue({ size: MAX_UPLOAD_SIZE_BYTES + 1 });
      const document = makeDocument();
      await expect(strategy.finalizeUpload(document)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(storageService.deleteFile).toHaveBeenCalledWith(document.object_key);
    });

    it('returns the verified real size for a valid object', async () => {
      storageService.headObject.mockResolvedValue({ size: 42 });
      await expect(strategy.finalizeUpload(makeDocument())).resolves.toEqual({
        size: 42,
      });
    });
  });
});

describe('UnsupportedStorageStrategy', () => {
  const strategy: DocumentStorageStrategy = new UnsupportedStorageStrategy(
    StorageProvider.LOCAL,
  );

  it('rejects every operation with a clear error', async () => {
    await expect(
      strategy.getUploadTarget({ documentId: 'd', objectKey: 'k', mimeType: 'm' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      strategy.store({ objectKey: 'k', buffer: Buffer.from(''), mimeType: 'm' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(() => strategy.buildViewUrl(makeDocument())).toThrow(BadRequestException);
    await expect(strategy.getSignedDownloadUrl(makeDocument())).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(strategy.retrieve(makeDocument())).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(strategy.finalizeUpload(makeDocument())).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(strategy.purge(makeDocument())).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});

describe('StorageStrategyFactory', () => {
  it('resolves S3 and DATABASE to their strategies, and anything else to Unsupported', () => {
    const s3Strategy = new S3StorageStrategy({} as any, { get: jest.fn() } as any);
    const databaseStrategy = new DatabaseStorageStrategy({ get: jest.fn() } as any);
    const factory = new StorageStrategyFactory(s3Strategy, databaseStrategy);

    expect(factory.resolve(StorageProvider.S3)).toBe(s3Strategy);
    expect(factory.resolve(StorageProvider.DATABASE)).toBe(databaseStrategy);
    expect(factory.resolve(StorageProvider.LOCAL)).toBeInstanceOf(
      UnsupportedStorageStrategy,
    );
  });
});
