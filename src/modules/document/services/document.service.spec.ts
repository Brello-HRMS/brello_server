import { BadRequestException, NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';

// uuid ships ESM-only; jest's default transform config can't parse it, so
// stub it out before document.service.ts (which imports uuid) loads.
jest.mock('uuid', () => ({ v4: () => 'mock-uuid' }));

import { DocumentService } from './document.service';
import { StorageStrategyFactory } from '../strategies/storage-strategy.factory';
import { S3StorageStrategy } from '../strategies/s3-storage.strategy';
import { DatabaseStorageStrategy } from '../strategies/database-storage.strategy';
import { Status } from '../../../common/enums';
import { StorageProvider, FolderType } from '../enums/document.enum';
import { LoggedInUser } from '../../auth/interfaces/logged-in-user.interface';
import { MAX_UPLOAD_SIZE_BYTES } from '../constants/document.constants';

const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const ownerUser: LoggedInUser = {
  userId: 'user1',
  enterpriseId: 'ent1',
  organizationId: 'org1',
  appId: 'app1',
  isPlatformAdmin: false,
};

const otherOrgSameEnterpriseUser: LoggedInUser = {
  ...ownerUser,
  userId: 'user2',
  organizationId: 'org2',
};

const foreignEnterpriseUser: LoggedInUser = {
  ...ownerUser,
  userId: 'user3',
  enterpriseId: 'ent2',
  organizationId: 'org9',
};

const platformAdmin: LoggedInUser = {
  ...ownerUser,
  userId: 'admin1',
  enterpriseId: 'ent-other',
  organizationId: 'org-other',
  isPlatformAdmin: true,
};

function makeDocument(overrides: Partial<any> = {}) {
  return {
    id: 'doc1',
    enterprise_id: 'ent1',
    organization_id: 'org1',
    employee_id: null,
    original_name: 'file.png',
    file_name: 'uuid.png',
    extension: 'png',
    mime_type: 'image/png',
    size: 100,
    storage_provider: StorageProvider.DATABASE,
    bucket: 'bucket',
    object_key: 'ent1/org1/documents/uuid.png',
    folder_type: FolderType.ORGANIZATION_DOCUMENT,
    is_public: false,
    checksum: null,
    version: 1,
    file_data: null,
    status: Status.ACTIVE,
    created_at: new Date(),
    ...overrides,
  };
}

describe('DocumentService', () => {
  let documentRepository: any;
  let storageService: any;
  let enterpriseService: any;
  let configService: any;
  let organizationService: any;
  let auditContext: any;
  let service: DocumentService;

  beforeEach(() => {
    documentRepository = {
      create: jest.fn((d) => ({ id: 'doc1', ...d })),
      findById: jest.fn(),
      findByIdWithContent: jest.fn(),
      update: jest.fn((id, data) => ({ ...makeDocument(), ...data, id })),
    };
    storageService = {
      getBucketName: jest.fn(() => 'bucket'),
      generatePresignedUploadUrl: jest.fn(),
      generatePresignedDownloadUrl: jest.fn(),
      uploadFile: jest.fn(),
      deleteFile: jest.fn(() => Promise.resolve()),
      headObject: jest.fn(),
    };
    enterpriseService = { findOneById: jest.fn() };
    configService = {
      get: jest.fn((key: string) =>
        key === 'auth.JWT_SECRET' ? 'test-secret' : undefined,
      ),
    };
    organizationService = { findOne: jest.fn() };
    auditContext = { setPreValue: jest.fn() };

    const storageStrategyFactory = new StorageStrategyFactory(
      new S3StorageStrategy(storageService, configService),
      new DatabaseStorageStrategy(configService),
    );

    service = new DocumentService(
      documentRepository,
      storageService,
      enterpriseService,
      configService,
      organizationService,
      auditContext,
      storageStrategyFactory,
    );
  });

  describe('tenant access control', () => {
    it('allows the owning org to read its own document', async () => {
      documentRepository.findById.mockResolvedValue(makeDocument());
      await expect(service.findOne('doc1', ownerUser)).resolves.toMatchObject({
        id: 'doc1',
      });
    });

    it('denies a user from a different enterprise (404, not 403)', async () => {
      documentRepository.findById.mockResolvedValue(makeDocument());
      await expect(
        service.findOne('doc1', foreignEnterpriseUser),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('denies a user from a different org in the same enterprise', async () => {
      documentRepository.findById.mockResolvedValue(makeDocument());
      await expect(
        service.findOne('doc1', otherOrgSameEnterpriseUser),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('allows enterprise-wide documents (null organization_id) across orgs in the same enterprise', async () => {
      documentRepository.findById.mockResolvedValue(
        makeDocument({ organization_id: null }),
      );
      await expect(
        service.findOne('doc1', otherOrgSameEnterpriseUser),
      ).resolves.toMatchObject({ id: 'doc1' });
    });

    it('lets a platform admin bypass tenant scoping entirely', async () => {
      documentRepository.findById.mockResolvedValue(makeDocument());
      await expect(service.findOne('doc1', platformAdmin)).resolves.toMatchObject({
        id: 'doc1',
      });
    });

    it('allows cross-tenant read of a document marked is_public', async () => {
      documentRepository.findById.mockResolvedValue(
        makeDocument({ is_public: true }),
      );
      await expect(
        service.findOne('doc1', foreignEnterpriseUser),
      ).resolves.toMatchObject({ id: 'doc1' });
    });

    it('does not let is_public bypass tenant scoping on delete', async () => {
      documentRepository.findById.mockResolvedValue(
        makeDocument({ is_public: true }),
      );
      await expect(
        service.remove('doc1', foreignEnterpriseUser),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('buildViewUrl routing', () => {
    it('routes non-image documents to the authenticated download endpoint, not a bearer signature URL', async () => {
      documentRepository.findById.mockResolvedValue(
        makeDocument({ folder_type: FolderType.EMPLOYEE_DOCUMENT }),
      );
      const result = await service.findOne('doc1', ownerUser);
      expect(result.url).toBe('/api/v1/documents/doc1/download');
    });

    it('routes image documents to a signed bearer view URL', async () => {
      documentRepository.findById.mockResolvedValue(
        makeDocument({ folder_type: FolderType.EMPLOYEE_IMAGE }),
      );
      const result = await service.findOne('doc1', ownerUser);
      expect(result.url).toContain('/api/v1/documents/doc1/view?sig=');
    });

    it('routes signature images to a signed bearer view URL, not the authenticated download endpoint', async () => {
      documentRepository.findById.mockResolvedValue(
        makeDocument({ folder_type: FolderType.LETTER_SIGNATURE }),
      );
      const result = await service.findOne('doc1', ownerUser);
      expect(result.url).toContain('/api/v1/documents/doc1/view?sig=');
    });
  });

  describe('confirmUpload', () => {
    it('is a no-op storage check for DATABASE-backed documents', async () => {
      documentRepository.findById.mockResolvedValue(
        makeDocument({ storage_provider: StorageProvider.DATABASE }),
      );
      await service.confirmUpload('doc1', ownerUser);
      expect(storageService.headObject).not.toHaveBeenCalled();
    });

    it('rejects confirmation when the S3 object was never actually uploaded', async () => {
      documentRepository.findById.mockResolvedValue(
        makeDocument({ storage_provider: StorageProvider.S3 }),
      );
      storageService.headObject.mockResolvedValue(null);

      await expect(
        service.confirmUpload('doc1', ownerUser),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects and deletes an S3 object that exceeds the max upload size', async () => {
      documentRepository.findById.mockResolvedValue(
        makeDocument({ storage_provider: StorageProvider.S3 }),
      );
      storageService.headObject.mockResolvedValue({
        size: MAX_UPLOAD_SIZE_BYTES + 1,
      });

      await expect(
        service.confirmUpload('doc1', ownerUser),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(storageService.deleteFile).toHaveBeenCalledWith(
        expect.any(String),
      );
    });

    it('persists the verified real size for a valid S3 upload', async () => {
      documentRepository.findById.mockResolvedValue(
        makeDocument({ storage_provider: StorageProvider.S3 }),
      );
      storageService.headObject.mockResolvedValue({ size: 12345 });

      await service.confirmUpload('doc1', ownerUser);

      const updateCall = documentRepository.update.mock.calls.find(
        (call: any[]) => call[1].status === Status.ACTIVE,
      );
      expect(updateCall[1].size).toBe(12345);
    });
  });

  describe('uploadFileContent', () => {
    it('rejects content upload once the document is no longer INACTIVE', async () => {
      documentRepository.findById.mockResolvedValue(
        makeDocument({ status: Status.ACTIVE }),
      );
      await expect(
        service.uploadFileContent('doc1', PNG_HEADER, ownerUser),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a buffer larger than the max upload size', async () => {
      documentRepository.findById.mockResolvedValue(
        makeDocument({ status: Status.INACTIVE }),
      );
      const oversized = Buffer.concat([
        PNG_HEADER,
        Buffer.alloc(MAX_UPLOAD_SIZE_BYTES),
      ]);
      await expect(
        service.uploadFileContent('doc1', oversized, ownerUser),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects content whose magic bytes do not match the declared mime type', async () => {
      documentRepository.findById.mockResolvedValue(
        makeDocument({ status: Status.INACTIVE, mime_type: 'image/png' }),
      );
      const fakePng = Buffer.from('<svg onload=alert(1)>');
      await expect(
        service.uploadFileContent('doc1', fakePng, ownerUser),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('accepts matching content, computes a checksum, and marks the document ACTIVE', async () => {
      documentRepository.findById.mockResolvedValue(
        makeDocument({ status: Status.INACTIVE, mime_type: 'image/png' }),
      );

      await service.uploadFileContent('doc1', PNG_HEADER, ownerUser);

      const expectedChecksum = crypto
        .createHash('sha256')
        .update(PNG_HEADER)
        .digest('hex');
      const updateCall = documentRepository.update.mock.calls[0][1];
      expect(updateCall.status).toBe(Status.ACTIVE);
      expect(updateCall.checksum).toBe(expectedChecksum);
    });

    it('denies uploading content to a document owned by a different tenant', async () => {
      documentRepository.findById.mockResolvedValue(
        makeDocument({ status: Status.INACTIVE }),
      );
      await expect(
        service.uploadFileContent('doc1', PNG_HEADER, foreignEnterpriseUser),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('getFileData', () => {
    it('serves image content with no user for the signature-gated view route', async () => {
      documentRepository.findByIdWithContent.mockResolvedValue(
        makeDocument({
          file_data: PNG_HEADER,
          folder_type: FolderType.EMPLOYEE_IMAGE,
        }),
      );
      await expect(service.getFileData('doc1')).resolves.toMatchObject({
        mimeType: 'image/png',
      });
    });

    it('rejects a non-image document with no user, even with a valid id', async () => {
      documentRepository.findByIdWithContent.mockResolvedValue(
        makeDocument({
          file_data: PNG_HEADER,
          folder_type: FolderType.ORGANIZATION_DOCUMENT,
        }),
      );
      await expect(service.getFileData('doc1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('enforces tenant scoping when a user is supplied (authenticated download route)', async () => {
      documentRepository.findByIdWithContent.mockResolvedValue(makeDocument());
      await expect(
        service.getFileData('doc1', foreignEnterpriseUser),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('remove', () => {
    it('clears file_data in place for DATABASE-backed documents', async () => {
      documentRepository.findById.mockResolvedValue(
        makeDocument({ storage_provider: StorageProvider.DATABASE }),
      );

      await service.remove('doc1', ownerUser);

      expect(storageService.deleteFile).not.toHaveBeenCalled();
      const purgeCall = documentRepository.update.mock.calls.find(
        (call: any[]) => 'file_data' in call[1],
      );
      expect(purgeCall[1].file_data).toBeNull();
    });

    it('deletes the S3 object for S3-backed documents', async () => {
      documentRepository.findById.mockResolvedValue(
        makeDocument({
          storage_provider: StorageProvider.S3,
          object_key: 'ent1/org1/documents/uuid.png',
        }),
      );

      await service.remove('doc1', ownerUser);

      expect(storageService.deleteFile).toHaveBeenCalledWith(
        'ent1/org1/documents/uuid.png',
      );
    });

    it('marks the document DELETED before purging storage, so a failed purge never leaves an ACTIVE record with deleted bytes', async () => {
      documentRepository.findById.mockResolvedValue(
        makeDocument({ storage_provider: StorageProvider.S3 }),
      );
      storageService.deleteFile.mockRejectedValueOnce(new Error('S3 unavailable'));

      await expect(service.remove('doc1', ownerUser)).rejects.toThrow(
        'S3 unavailable',
      );

      const statusUpdateCall = documentRepository.update.mock.calls.find(
        (call: any[]) => call[1].status === Status.DELETED,
      );
      expect(statusUpdateCall).toBeDefined();
      expect(documentRepository.update.mock.invocationCallOrder[0]).toBeLessThan(
        storageService.deleteFile.mock.invocationCallOrder[0],
      );
    });
  });
});
