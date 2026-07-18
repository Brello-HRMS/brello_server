import { BadRequestException } from '@nestjs/common';

// uuid ships ESM-only; jest's default transform config can't parse it, so
// stub it out before document.controller.ts (which pulls in document.service.ts,
// which imports uuid) loads.
jest.mock('uuid', () => ({ v4: () => 'mock-uuid' }));

import { DocumentController } from './document.controller';
import { LoggedInUser } from '../../auth/interfaces/logged-in-user.interface';

const user: LoggedInUser = {
  userId: 'user1',
  enterpriseId: 'ent1',
  organizationId: 'org1',
  appId: 'app1',
  isPlatformAdmin: false,
};

describe('DocumentController', () => {
  let documentService: any;
  let controller: DocumentController;

  beforeEach(() => {
    documentService = {
      uploadFileContent: jest.fn(() => Promise.resolve({ success: true })),
      confirmUpload: jest.fn(() => Promise.resolve({ id: 'doc1' })),
    };
    controller = new DocumentController(documentService);
  });

  describe('uploadFile', () => {
    it('rejects the request when no file was attached', async () => {
      await expect(
        controller.uploadFile('doc1', undefined as any, user),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(documentService.uploadFileContent).not.toHaveBeenCalled();
    });

    it('forwards the buffer when a file is attached', async () => {
      const file = { buffer: Buffer.from('x'), originalname: 'a.png', mimetype: 'image/png', size: 1 };
      await controller.uploadFile('doc1', file, user);
      expect(documentService.uploadFileContent).toHaveBeenCalledWith(
        'doc1',
        file.buffer,
        user,
      );
    });
  });

  describe('confirmUpload', () => {
    it('rejects when the body id does not match the path id', async () => {
      expect(() =>
        controller.confirmUpload('doc1', { id: 'doc2' }, user),
      ).toThrow(BadRequestException);
      expect(documentService.confirmUpload).not.toHaveBeenCalled();
    });

    it('proceeds when the body id matches the path id', async () => {
      await controller.confirmUpload('doc1', { id: 'doc1' }, user);
      expect(documentService.confirmUpload).toHaveBeenCalledWith('doc1', user);
    });
  });
});
