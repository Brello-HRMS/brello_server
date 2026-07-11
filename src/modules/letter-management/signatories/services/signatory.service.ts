import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { SignatoryRepository } from '../repositories/signatory.repository';
import { Signatory } from '../entities/signatory.entity';
import { CreateSignatoryDto, UpdateSignatoryDto } from '../dto/signatory.dto';
import { LoggedInUser } from '../../../auth/interfaces/logged-in-user.interface';
import { Status } from '../../../../common/enums';
import { DocumentService } from '../../../document/services/document.service';
import { FolderType } from '../../../document/enums/document.enum';
import { AuditContextService } from '../../../audit/services/audit-context.service';

type UploadedFile = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
};

@Injectable()
export class SignatoryService {
  private readonly logger = new Logger(SignatoryService.name);

  constructor(
    private readonly signatoryRepository: SignatoryRepository,
    private readonly documentService: DocumentService,
    private readonly auditContext: AuditContextService,
  ) {}

  async create(
    user: LoggedInUser,
    dto: CreateSignatoryDto,
    file: UploadedFile,
  ): Promise<Signatory> {
    this.logger.log(`Creating signatory: ${dto.name} for org: ${user.organizationId}`);

    const document = await this.documentService.uploadDocument(
      user,
      file,
      FolderType.LETTER_SIGNATURE,
    );

    const isDefault = dto.is_default === true;

    if (isDefault) {
      await this.signatoryRepository.clearDefaultForOrg(user.organizationId);
    }

    return this.signatoryRepository.create({
      name: dto.name,
      designation: dto.designation,
      is_default: isDefault,
      signature_document_id: document.id,
      organization_id: user.organizationId,
      enterprise_id: user.enterpriseId,
      modified_by: user.userId,
      status: Status.ACTIVE,
    });
  }

  async findAll(
    user: LoggedInUser,
    filters: { status?: Status; search?: string } = {},
  ): Promise<Signatory[]> {
    return this.signatoryRepository.findAllByOrg(user.organizationId, filters);
  }

  async findOne(user: LoggedInUser, id: string): Promise<Signatory> {
    const signatory = await this.signatoryRepository.findOneByOrg(id, user.organizationId);

    if (!signatory) {
      throw new NotFoundException(`Signatory with ID '${id}' not found`);
    }

    return signatory;
  }

  async update(user: LoggedInUser, id: string, dto: UpdateSignatoryDto): Promise<Signatory> {
    this.logger.log(`Updating signatory: ${id} for org: ${user.organizationId}`);

    const existing = await this.findOne(user, id);
    this.auditContext.setPreValue(existing as unknown as Record<string, unknown>);

    if (dto.is_default === true && !existing.is_default) {
      await this.signatoryRepository.clearDefaultForOrg(user.organizationId, id);
    }

    const updated = await this.signatoryRepository.update(id, {
      ...dto,
      modified_by: user.userId,
    });

    if (!updated) {
      throw new NotFoundException(`Signatory with ID '${id}' not found after update`);
    }

    return updated;
  }

  async setDefault(user: LoggedInUser, id: string): Promise<Signatory> {
    this.logger.log(`Setting signatory ${id} as default for org: ${user.organizationId}`);

    const existing = await this.findOne(user, id);
    this.auditContext.setPreValue(existing as unknown as Record<string, unknown>);

    await this.signatoryRepository.clearDefaultForOrg(user.organizationId, id);

    const updated = await this.signatoryRepository.update(id, {
      is_default: true,
      modified_by: user.userId,
    });

    if (!updated) {
      throw new NotFoundException(`Signatory with ID '${id}' not found after update`);
    }

    return updated;
  }

  async archive(user: LoggedInUser, id: string): Promise<Signatory> {
    this.logger.log(`Archiving signatory: ${id} for org: ${user.organizationId}`);

    const existing = await this.findOne(user, id);
    this.auditContext.setPreValue(existing as unknown as Record<string, unknown>);

    if (existing.is_default) {
      throw new ConflictException(
        'Cannot archive the default signatory. Assign another default first.',
      );
    }

    const updated = await this.signatoryRepository.update(id, {
      status: Status.ARCHIVED,
      modified_by: user.userId,
    });

    if (!updated) {
      throw new NotFoundException(`Signatory with ID '${id}' not found after update`);
    }

    return updated;
  }

  async unarchive(user: LoggedInUser, id: string): Promise<Signatory> {
    this.logger.log(`Unarchiving signatory: ${id} for org: ${user.organizationId}`);

    const existing = await this.findOne(user, id);
    if (existing.status !== Status.ARCHIVED) {
      throw new ConflictException('Only archived signatories can be restored');
    }
    this.auditContext.setPreValue(existing as unknown as Record<string, unknown>);

    const updated = await this.signatoryRepository.update(id, {
      status: Status.ACTIVE,
      modified_by: user.userId,
    });

    if (!updated) {
      throw new NotFoundException(`Signatory with ID '${id}' not found after restore`);
    }

    return updated;
  }
}
