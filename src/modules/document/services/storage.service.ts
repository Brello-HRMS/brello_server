import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private s3Client: S3Client;
  private bucketName: string;

  constructor(private readonly configService: ConfigService) {
    // Fallback to dummy values for local development if not provided in YAML
    this.bucketName =
      this.configService.get<string>('aws.s3.bucketName') ||
      'brello-uploads-local';
    const region = this.configService.get<string>('aws.region') || 'us-east-1';

    this.s3Client = new S3Client({
      region,
      // Only set credentials locally if explicitly provided (otherwise handles IAM roles automatically in prod)
      /* 
            credentials: {
                accessKeyId: this.configService.get<string>('aws.accessKeyId'),
                secretAccessKey: this.configService.get<string>('aws.secretAccessKey'),
            },
            */
    });
  }

  getBucketName(): string {
    return this.bucketName;
  }

  async generatePresignedUploadUrl(
    objectKey: string,
    mimeType: string,
    expiresIn: number = 300,
  ): Promise<string> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: objectKey,
        ContentType: mimeType,
      });

      const signedUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn,
      });
      return signedUrl;
    } catch (error) {
      this.logger.error(
        `Failed to generate pre-signed upload URL for ${objectKey}`,
        error,
      );
      throw error;
    }
  }

  async generatePresignedDownloadUrl(
    objectKey: string,
    expiresIn: number = 900,
  ): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: objectKey,
      });

      const signedUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn,
      });
      return signedUrl;
    } catch (error) {
      this.logger.error(
        `Failed to generate pre-signed download URL for ${objectKey}`,
        error,
      );
      throw error;
    }
  }
  async uploadFile(
    fileBuffer: Buffer,
    objectKey: string,
    mimeType: string,
  ): Promise<void> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: objectKey,
        Body: fileBuffer,
        ContentType: mimeType,
      });

      await this.s3Client.send(command);
    } catch (error) {
      this.logger.error(`Failed to upload file to S3: ${objectKey}`, error);
      throw error;
    }
  }
}
