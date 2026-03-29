import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import { DocumentRepository } from '../repositories/document.repository';
import { StorageService } from './storage.service';
import { EnterpriseService } from '../../enterprise/services/enterprise.service';
import { OrganizationService } from '../../organization/services/organization.service';
import { GenerateUploadUrlDto } from '../dto/generate-upload-url.dto';
import { FolderType, StorageProvider } from '../enums/document.enum';
import { Status } from '../../../common/enums';
import { Document } from '../entities/document.entity';
import { Organization } from 'src/modules/organization/entities/organization.entity';
import { LoggedInUser } from '../../auth/interfaces/logged-in-user.interface';

@Injectable()
export class DocumentService {
  private readonly logger = new Logger(DocumentService.name);

  constructor(
    private readonly documentRepository: DocumentRepository,
    private readonly storageService: StorageService,
    private readonly enterpriseService: EnterpriseService,
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => OrganizationService))
    private readonly organizationService: OrganizationService,
  ) {}

  private getStorageProvider(): StorageProvider {
    return (
      this.configService.get<StorageProvider>('storage.provider') ||
      StorageProvider.S3
    );
  }

  private slugify(text: string): string {
    return text
      .toString()
      .toLowerCase()
      .replace(/\s+/g, '-') // Replace spaces with -
      .replace(/[^\w\-]+/g, '') // Remove all non-word chars
      .replace(/\-\-+/g, '-') // Replace multiple - with single -
      .replace(/^-+/, '') // Trim - from start of text
      .replace(/-+$/, ''); // Trim - from end of text
  }

  async generateObjectKey(params: {
    enterpriseCode: string;
    organizationCode?: string | null;
    employeeId?: string;
    folderType: FolderType;
    fileName: string;
  }): Promise<string> {
    const enterprise = this.slugify(params.enterpriseCode);
    const organization = params.organizationCode
      ? this.slugify(params.organizationCode)
      : null;

    switch (params.folderType) {
      case FolderType.ENTERPRISE_LOGO:
        return `${enterprise}/logo/${params.fileName}`;

      case FolderType.ORGANIZATION_LOGO:
        if (!organization)
          throw new BadRequestException(
            'Organization context required for ORGANIZATION_LOGO',
          );
        return `${enterprise}/${organization}/logo/${params.fileName}`;

      case FolderType.EMPLOYEE_IMAGE:
        if (!organization || !params.employeeId)
          throw new BadRequestException(
            'Organization and Employee context required for EMPLOYEE_IMAGE',
          );
        return `${enterprise}/${organization}/employee/${params.employeeId}/images/${params.fileName}`;

      case FolderType.EMPLOYEE_DOCUMENT:
        if (!organization || !params.employeeId)
          throw new BadRequestException(
            'Organization and Employee context required for EMPLOYEE_DOCUMENT',
          );
        return `${enterprise}/${organization}/employee/${params.employeeId}/documents/${params.fileName}`;

      case FolderType.ORGANIZATION_DOCUMENT:
        if (!organization)
          throw new BadRequestException(
            'Organization context required for ORGANIZATION_DOCUMENT',
          );
        return `${enterprise}/${organization}/documents/${params.fileName}`;

      default:
        throw new BadRequestException('Invalid folder type');
    }
  }

  async generateUploadUrl(user: LoggedInUser, dto: GenerateUploadUrlDto) {
    this.logger.log(
      `Generating upload URL for ${dto.folderType} requested by user ${user.userId}`,
    );

    const provider = this.getStorageProvider();

    // Validate Enterprise (and get code for slug)
    const enterprise = await this.enterpriseService.findOneById(
      dto.enterpriseId,
      user,
    );

    // Validate Organization (if provided)
    let organization: Organization | null = null;
    if (dto.organizationId) {
      organization = await this.organizationService.findOne(
        dto.organizationId,
        user,
      );
    }

    // Generate safe file name (uuid + extension)
    const extension = dto.originalName.includes('.')
      ? dto.originalName.split('.').pop()!
      : '';
    const fileName = extension ? `${uuidv4()}.${extension}` : uuidv4();

    // Generate dynamic folder path (object key)
    const objectKey = await this.generateObjectKey({
      enterpriseCode: enterprise.name, // Using name as code for slugification since base entity code might be optional
      organizationCode: organization?.name,
      employeeId: dto.employeeId,
      folderType: dto.folderType,
      fileName: fileName,
    });

    // Create document record in INACTIVE state
    const document = await this.documentRepository.create({
      enterprise_id: dto.enterpriseId,
      organization_id: dto.organizationId,
      employee_id: dto.employeeId,
      original_name: dto.originalName,
      file_name: fileName,
      extension: extension,
      mime_type: dto.mimeType,
      size: dto.size,
      storage_provider: provider,
      bucket: this.storageService.getBucketName(),
      object_key: objectKey,
      folder_type: dto.folderType,
      status: Status.INACTIVE,
      created_by: user.userId,
    } as Partial<Document>);

    let uploadUrl = '';
    if (provider === StorageProvider.S3) {
      // Generate S3 Pre-signed URL
      uploadUrl = await this.storageService.generatePresignedUploadUrl(
        objectKey,
        dto.mimeType,
      );
    } else {
      // For local/db, we return a local URL
      uploadUrl = `/api/v1/documents/${document.id}/confirm`; // Simplified for DB storage
    }

    return {
      documentId: document.id,
      uploadUrl,
      objectKey,
      expiresIn: 300,
    };
  }

  async confirmUpload(id: string, user: LoggedInUser) {
    this.logger.log(
      `Confirming upload for document ${id} by user ${user.userId}`,
    );

    const document = await this.documentRepository.findById(id);
    if (!document) {
      throw new NotFoundException(`Document ${id} not found`);
    }

    // Mark as ACTIVE
    const updatedDoc = await this.documentRepository.update(id, {
      status: Status.ACTIVE,
      modified_by: user.userId,
    });

    // Construct public URL
    let url = '';
    if (document.storage_provider === StorageProvider.S3) {
      const region = 'us-east-1'; // Grab from config in real app
      url = `https://${document.bucket}.s3.${region}.amazonaws.com/${document.object_key}`;
    } else {
      url = `/api/v1/documents/${document.id}/view`;
    }

    return {
      id: updatedDoc!.id,
      url,
      status: updatedDoc!.status,
    };
  }

  async findOne(id: string, user: LoggedInUser) {
    const document = await this.documentRepository.findById(id);
    if (!document) {
      throw new NotFoundException(`Document ${id} not found`);
    }

    return {
      id: document.id,
      originalName: document.original_name,
      mimeType: document.mime_type,
      size: document.size,
      folderType: document.folder_type,
      isPublic: document.is_public,
      createdAt: document.created_at,
    };
  }

  async getSignedUrl(id: string, user: LoggedInUser) {
    const document = await this.documentRepository.findById(id);
    if (!document) {
      throw new NotFoundException(`Document ${id} not found`);
    }

    if (document.status !== Status.ACTIVE) {
      throw new BadRequestException(
        'Document upload was not confirmed or is inactive',
      );
    }

    if (document.storage_provider === StorageProvider.DATABASE) {
      return { url: `/api/v1/documents/${id}/view` };
    }

    const url = await this.storageService.generatePresignedDownloadUrl(
      document.object_key,
    );

    return { url };
  }

  async uploadDocument(
    user: LoggedInUser,
    file: {
      buffer: Buffer;
      originalname: string;
      mimetype: string;
      size: number;
    },
    folderType: FolderType,
    employeeId?: string,
  ): Promise<Document> {
    this.logger.log(`Directly uploading ${folderType} for user ${user.userId}`);

    const provider = this.getStorageProvider();

    // 1. Validate/Get Enterprise context
    const enterprise = await this.enterpriseService.findOneById(
      user.enterpriseId,
      user,
    );

    // 2. Validate/Get Organization context (if required by folder type or token)
    let organization: Organization | null = null;
    if (user.organizationId) {
      organization = await this.organizationService.findOne(
        user.organizationId,
        user,
      );
    }

    // 3. Generate safe file name and object key
    const extension = file.originalname.includes('.')
      ? file.originalname.split('.').pop()!
      : '';
    const fileName = extension ? `${uuidv4()}.${extension}` : uuidv4();

    const objectKey = await this.generateObjectKey({
      enterpriseCode: enterprise.name,
      organizationCode: organization?.name,
      employeeId,
      folderType,
      fileName,
    });

    // 4. Upload to S3 or DB
    if (provider === StorageProvider.S3) {
      await this.storageService.uploadFile(
        file.buffer,
        objectKey,
        file.mimetype,
      );
    }

    // 5. Create Document record as ACTIVE
    return this.documentRepository.create({
      enterprise_id: user.enterpriseId,
      organization_id: user.organizationId,
      employee_id: employeeId,
      original_name: file.originalname,
      file_name: fileName,
      extension: extension,
      mime_type: file.mimetype,
      size: file.size,
      storage_provider: provider,
      bucket: this.storageService.getBucketName(),
      object_key: objectKey,
      folder_type: folderType,
      status: Status.ACTIVE,
      created_by: user.userId,
      file_data: provider === StorageProvider.DATABASE ? file.buffer : null,
    } as Partial<Document>);
  }

  async getFileData(id: string) {
    const document = await this.documentRepository.findByIdWithContent(id);
    if (!document) {
      throw new NotFoundException(`Document ${id} not found`);
    }

    if (document.storage_provider !== StorageProvider.DATABASE) {
      throw new BadRequestException('Document is not stored in the database');
    }

    return {
      buffer: document.file_data,
      mimeType: document.mime_type,
      fileName: document.original_name,
    };
  }

  async remove(id: string, user: LoggedInUser) {
    this.logger.log(`Soft deleting document ${id} by user ${user.userId}`);

    const document = await this.documentRepository.findById(id);
    if (!document) {
      throw new NotFoundException(`Document ${id} not found`);
    }

    await this.documentRepository.update(id, {
      status: Status.DELETED,
      deleted_by: user.userId,
      deleted_at: new Date(),
    } as unknown as Partial<Document>);

    return { success: true };
  }
}
