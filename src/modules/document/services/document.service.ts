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
import {
  FolderType,
  StorageProvider,
  isImageFolderType,
} from '../enums/document.enum';
import { Status } from '../../../common/enums';
import { Document } from '../entities/document.entity';
import { Organization } from 'src/modules/organization/entities/organization.entity';
import { LoggedInUser } from '../../auth/interfaces/logged-in-user.interface';
import { AuditContextService } from '../../audit/services/audit-context.service';
import { MAX_UPLOAD_SIZE_BYTES } from '../constants/document.constants';
import { validateFileSignature } from '../utils/file-signature.util';
import { StorageStrategyFactory } from '../strategies/storage-strategy.factory';
import * as crypto from 'crypto';

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
    private readonly auditContext: AuditContextService,
    private readonly storageStrategyFactory: StorageStrategyFactory,
  ) {}

  private getStorageProvider(): StorageProvider {
    return (
      this.configService.get<StorageProvider>('storage.provider') ??
      StorageProvider.DATABASE
    );
  }

  buildViewUrl(document: Document): string {
    return this.storageStrategyFactory
      .resolve(document.storage_provider)
      .buildViewUrl(document);
  }

  private assertDocumentAccess(
    document: Document,
    user: LoggedInUser,
    options: { allowPublicRead?: boolean } = {},
  ): void {
    if (!user) {
      throw new NotFoundException(`Document ${document.id} not found`);
    }
    if (user.isPlatformAdmin) return;
    if (options.allowPublicRead && document.is_public) return;

    const sameEnterprise = document.enterprise_id === user.enterpriseId;
    const sameOrganization =
      !document.organization_id ||
      document.organization_id === user.organizationId;

    if (!sameEnterprise || !sameOrganization) {
      throw new NotFoundException(`Document ${document.id} not found`);
    }
  }

  private slugify(text: string): string {
    return text
      .toString()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^\w\-]+/g, '')
      .replace(/\-\-+/g, '-')
      .replace(/^-+/, '')
      .replace(/-+$/, '');
  }

  private requireOrganization(
    organization: string | null,
    folderType: FolderType,
  ): string {
    if (!organization) {
      throw new BadRequestException(
        `Organization context required for ${folderType}`,
      );
    }
    return organization;
  }

  private requireEmployeeId(
    employeeId: string | undefined,
    folderType: FolderType,
  ): string {
    if (!employeeId) {
      throw new BadRequestException(
        `Employee context required for ${folderType}`,
      );
    }
    return employeeId;
  }

  private computeVerifiedChecksum(buffer: Buffer, mimeType: string): string {
    if (buffer.length > MAX_UPLOAD_SIZE_BYTES) {
      throw new BadRequestException(
        `File exceeds the maximum allowed size of ${MAX_UPLOAD_SIZE_BYTES} bytes`,
      );
    }
    if (!validateFileSignature(buffer, mimeType)) {
      throw new BadRequestException(
        `File content does not match the declared mime type (${mimeType})`,
      );
    }
    return crypto.createHash('sha256').update(buffer).digest('hex');
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
    const { folderType, employeeId, fileName } = params;

    switch (folderType) {
      case FolderType.ENTERPRISE_LOGO:
        return `${enterprise}/logo/${fileName}`;

      case FolderType.ORGANIZATION_LOGO:
        return `${enterprise}/${this.requireOrganization(organization, folderType)}/logo/${fileName}`;

      case FolderType.EMPLOYEE_IMAGE:
        return `${enterprise}/${this.requireOrganization(organization, folderType)}/employee/${this.requireEmployeeId(employeeId, folderType)}/images/${fileName}`;

      case FolderType.EMPLOYEE_DOCUMENT:
        return `${enterprise}/${this.requireOrganization(organization, folderType)}/employee/${this.requireEmployeeId(employeeId, folderType)}/documents/${fileName}`;

      case FolderType.ORGANIZATION_DOCUMENT:
        return `${enterprise}/${this.requireOrganization(organization, folderType)}/documents/${fileName}`;

      case FolderType.REIMBURSEMENT_DOCUMENT:
        return `${enterprise}/${this.requireOrganization(organization, folderType)}/reimbursements/${fileName}`;

      case FolderType.FEEDBACK_ATTACHMENT:
        return `${enterprise}/${this.requireOrganization(organization, folderType)}/feedback/${fileName}`;

      case FolderType.LETTER_SIGNATURE:
        return `${enterprise}/${this.requireOrganization(organization, folderType)}/letters/signatures/${fileName}`;

      case FolderType.LETTER_DOCUMENT:
        return `${enterprise}/${this.requireOrganization(organization, folderType)}/employee/${this.requireEmployeeId(employeeId, folderType)}/letters/${fileName}`;

      case FolderType.OFFER_DOCUMENT:
        return `${enterprise}/${this.requireOrganization(organization, folderType)}/offers/${fileName}`;

      default:
        throw new BadRequestException('Invalid folder type');
    }
  }

  async generateUploadUrl(user: LoggedInUser, dto: GenerateUploadUrlDto) {
    this.logger.log(
      `Generating upload URL for ${dto.folderType} requested by user ${user.userId}`,
    );

    const provider = this.getStorageProvider();
    const enterpriseId = dto.enterpriseId ?? user.enterpriseId;
    const organizationId = dto.organizationId ?? user.organizationId;

    const enterprise = await this.enterpriseService.findOneById(
      enterpriseId,
      user,
    );

    let organization: Organization | null = null;
    if (organizationId) {
      organization = await this.organizationService.findOne(
        organizationId,
        user,
      );
    }

    const extension = dto.originalName.includes('.')
      ? dto.originalName.split('.').pop()!
      : '';
    const fileName = extension ? `${uuidv4()}.${extension}` : uuidv4();

    const objectKey = await this.generateObjectKey({
      enterpriseCode: enterprise.name,
      organizationCode: organization?.name,
      employeeId: dto.employeeId,
      folderType: dto.folderType,
      fileName,
    });

    const document = await this.documentRepository.create({
      enterprise_id: enterpriseId,
      organization_id: organizationId,
      employee_id: dto.employeeId,
      original_name: dto.originalName,
      file_name: fileName,
      extension,
      mime_type: dto.mimeType,
      size: dto.size,
      storage_provider: provider,
      bucket: this.storageService.getBucketName(),
      object_key: objectKey,
      folder_type: dto.folderType,
      status: Status.INACTIVE,
      created_by: user.userId,
    } as Partial<Document>);

    const uploadUrl = await this.storageStrategyFactory
      .resolve(provider)
      .getUploadTarget({
        documentId: document.id,
        objectKey,
        mimeType: dto.mimeType,
      });

    return {
      documentId: document.id,
      uploadUrl,
      objectKey,
      expiresIn: 300,
    };
  }

  async uploadFileContent(id: string, buffer: Buffer, user: LoggedInUser) {
    const document = await this.documentRepository.findById(id);
    if (!document) {
      throw new NotFoundException(`Document ${id} not found`);
    }
    this.assertDocumentAccess(document, user);

    if (document.status !== Status.INACTIVE) {
      throw new BadRequestException(
        'Document content can only be uploaded once, while the document is INACTIVE',
      );
    }

    const checksum = this.computeVerifiedChecksum(buffer, document.mime_type);

    await this.documentRepository.update(id, {
      file_data: buffer,
      checksum,
      status: Status.ACTIVE,
      modified_by: user.userId,
    } as unknown as Partial<Document>);

    return {
      success: true,
      id,
      url: `/api/v1/documents/${id}/view`,
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
    this.assertDocumentAccess(document, user);

    const verifiedFields = await this.storageStrategyFactory
      .resolve(document.storage_provider)
      .finalizeUpload(document);

    const updatedDocument = await this.documentRepository.update(id, {
      status: Status.ACTIVE,
      modified_by: user.userId,
      ...verifiedFields,
    });

    return {
      id: updatedDocument!.id,
      url: this.buildViewUrl(document),
      status: updatedDocument!.status,
    };
  }

  async findOne(id: string, user: LoggedInUser) {
    const document = await this.documentRepository.findById(id);
    if (!document) {
      throw new NotFoundException(`Document ${id} not found`);
    }
    this.assertDocumentAccess(document, user, { allowPublicRead: true });

    return {
      id: document.id,
      originalName: document.original_name,
      mimeType: document.mime_type,
      size: document.size,
      folderType: document.folder_type,
      isPublic: document.is_public,
      createdAt: document.created_at,
      url: this.buildViewUrl(document),
    };
  }

  async getSignedUrl(id: string, user: LoggedInUser) {
    const document = await this.documentRepository.findById(id);
    if (!document) {
      throw new NotFoundException(`Document ${id} not found`);
    }
    this.assertDocumentAccess(document, user, { allowPublicRead: true });

    if (document.status !== Status.ACTIVE) {
      throw new BadRequestException(
        'Document upload was not confirmed or is inactive',
      );
    }

    const url = await this.storageStrategyFactory
      .resolve(document.storage_provider)
      .getSignedDownloadUrl(document);

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

    const checksum = this.computeVerifiedChecksum(file.buffer, file.mimetype);
    const provider = this.getStorageProvider();

    const enterprise = await this.enterpriseService.findOneById(
      user.enterpriseId,
      user,
    );

    let organization: Organization | null = null;
    if (user.organizationId) {
      organization = await this.organizationService.findOne(
        user.organizationId,
        user,
      );
    }

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

    const storageFields = await this.storageStrategyFactory
      .resolve(provider)
      .store({ objectKey, buffer: file.buffer, mimeType: file.mimetype });

    return this.documentRepository.create({
      enterprise_id: user.enterpriseId,
      organization_id: user.organizationId,
      employee_id: employeeId,
      original_name: file.originalname,
      file_name: fileName,
      extension,
      mime_type: file.mimetype,
      size: file.size,
      checksum,
      storage_provider: provider,
      bucket: this.storageService.getBucketName(),
      object_key: objectKey,
      folder_type: folderType,
      status: Status.ACTIVE,
      created_by: user.userId,
      ...storageFields,
    } as Partial<Document>);
  }

  async getFileData(id: string, user?: LoggedInUser) {
    const document = await this.documentRepository.findByIdWithContent(id);
    if (!document) {
      throw new NotFoundException(`Document ${id} not found`);
    }

    if (user) {
      this.assertDocumentAccess(document, user, { allowPublicRead: true });
    } else if (!isImageFolderType(document.folder_type)) {
      throw new NotFoundException(`Document ${id} not found`);
    }

    return this.storageStrategyFactory
      .resolve(document.storage_provider)
      .retrieve(document);
  }

  async remove(id: string, user: LoggedInUser) {
    this.logger.log(`Soft deleting document ${id} by user ${user.userId}`);

    const document = await this.documentRepository.findById(id);
    if (!document) {
      throw new NotFoundException(`Document ${id} not found`);
    }
    this.assertDocumentAccess(document, user);

    this.auditContext.setPreValue(document as unknown as Record<string, unknown>);

    await this.documentRepository.update(id, {
      status: Status.DELETED,
      deleted_by: user.userId,
      deleted_at: new Date(),
    } as unknown as Partial<Document>);

    const purgeFields = await this.storageStrategyFactory
      .resolve(document.storage_provider)
      .purge(document);

    if (Object.keys(purgeFields).length > 0) {
      await this.documentRepository.update(id, purgeFields as Partial<Document>);
    }

    return { success: true };
  }
}
