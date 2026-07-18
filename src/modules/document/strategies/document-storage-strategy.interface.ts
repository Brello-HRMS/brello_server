import { Document } from '../entities/document.entity';

export interface UploadTargetParams {
  documentId: string;
  objectKey: string;
  mimeType: string;
}

export interface StoreParams {
  objectKey: string;
  buffer: Buffer;
  mimeType: string;
}

export interface RetrievedFile {
  buffer: Buffer;
  mimeType: string;
  fileName: string;
}

export interface DocumentStorageStrategy {
  getUploadTarget(params: UploadTargetParams): Promise<string>;
  store(params: StoreParams): Promise<Partial<Document>>;
  finalizeUpload(document: Document): Promise<Partial<Document>>;
  buildViewUrl(document: Document): string;
  getSignedDownloadUrl(document: Document): Promise<string>;
  retrieve(document: Document): Promise<RetrievedFile>;
  purge(document: Document): Promise<Partial<Document>>;
}
