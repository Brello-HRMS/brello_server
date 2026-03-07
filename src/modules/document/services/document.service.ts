import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
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

@Injectable()
export class DocumentService {
  private readonly logger = new Logger(DocumentService.name);

  constructor(
    private readonly documentRepository: DocumentRepository,
    private readonly storageService: StorageService,
    private readonly enterpriseService: EnterpriseService,
    @Inject(forwardRef(() => OrganizationService))
    private readonly organizationService: OrganizationService,
  ) {}

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

  async generateUploadUrl(userId: string, dto: GenerateUploadUrlDto) {
    this.logger.log(
      `Generating upload URL for ${dto.folderType} requested by user ${userId}`,
    );

    // Validate Enterprise (and get code for slug)
    const enterprise = await this.enterpriseService.findOneById(
      dto.enterpriseId,
    );

    // Validate Organization (if provided)
    let organization: Organization | null = null;
    if (dto.organizationId) {
      organization = await this.organizationService.findOne(dto.organizationId);
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
      storage_provider: StorageProvider.S3,
      bucket: this.storageService.getBucketName(),
      object_key: objectKey,
      folder_type: dto.folderType,
      base_status: Status.INACTIVE,
      created_by: userId,
    } as Partial<Document>);

    // Generate S3 Pre-signed URL
    const uploadUrl = await this.storageService.generatePresignedUploadUrl(
      objectKey,
      dto.mimeType,
    );

    return {
      documentId: document.id,
      uploadUrl,
      objectKey,
      expiresIn: 300,
    };
  }

  async confirmUpload(id: string, userId: string) {
    this.logger.log(`Confirming upload for document ${id} by user ${userId}`);

    const document = await this.documentRepository.findById(id);
    if (!document) {
      throw new NotFoundException(`Document ${id} not found`);
    }

    // Mark as ACTIVE
    const updatedDoc = await this.documentRepository.update(id, {
      base_status: Status.ACTIVE,
      modified_by: userId,
    });

    // TODO: In a real system, we'd verify the file actually exists in S3 here by calling headObject
    // before marking it active.

    // Construct public URL (if CDN is configured) or return standard S3 URL
    const region = 'us-east-1'; // Grab from config in real app
    const url = `https://${document.bucket}.s3.${region}.amazonaws.com/${document.object_key}`;

    return {
      id: updatedDoc!.id,
      url,
      status: updatedDoc!.base_status,
    };
  }

  async findOne(id: string) {
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

  async getSignedUrl(id: string) {
    const document = await this.documentRepository.findById(id);
    if (!document) {
      throw new NotFoundException(`Document ${id} not found`);
    }

    if (document.base_status !== Status.ACTIVE) {
      throw new BadRequestException(
        'Document upload was not confirmed or is inactive',
      );
    }

    const url = await this.storageService.generatePresignedDownloadUrl(
      document.object_key,
    );

    return { url };
  }

  async remove(id: string, userId: string) {
    this.logger.log(`Soft deleting document ${id} by user ${userId}`);

    const document = await this.documentRepository.findById(id);
    if (!document) {
      throw new NotFoundException(`Document ${id} not found`);
    }

    await this.documentRepository.update(id, {
      base_status: Status.DELETED,
      deleted_by: userId,
      deleted_at: new Date(),
    } as unknown as Partial<Document>);

    return { success: true };
  }
}
