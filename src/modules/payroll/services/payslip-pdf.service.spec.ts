import { NotFoundException } from '@nestjs/common';
import { PayslipPdfService } from './payslip-pdf.service';
import { PayrollItemStatus } from '../enums/payroll.enum';
import { LoggedInUser } from '../../auth/interfaces/logged-in-user.interface';

const user: LoggedInUser = {
  userId: 'u1',
  enterpriseId: 'ent1',
  organizationId: 'org1',
  appId: 'app1',
  isPlatformAdmin: false,
};

const samplePayslip = {
  period: { month: 'apr', year: 2026 },
  employee: { user_id: 'emp1', name: 'Asha Rao' },
  attendance: {
    total_working_days: 30,
    present_days: 28,
    paid_leave_days: 1,
    lop_days: 1,
  },
  earnings: [{ name: 'Basic', calculated_value: 10000 }],
  deductions: [{ name: 'PF', calculated_value: 1200 }],
  adjustments: [{ type: 'bonus', amount: 5000, reason: 'Diwali' }],
  summary: {
    gross: 15000,
    deductions_total: 1200,
    reimbursement_total: 500,
    bonus_total: 5000,
    net: 14300,
  },
};

describe('PayslipPdfService', () => {
  let itemRepo: any;
  let payslipService: any;
  let storage: any;
  let service: PayslipPdfService;

  beforeEach(() => {
    itemRepo = {
      findById: jest.fn(),
      findAllByRun: jest.fn(),
      save: jest.fn((i) => i),
    };
    payslipService = { getPayslip: jest.fn().mockResolvedValue(samplePayslip) };
    storage = {
      uploadFile: jest.fn(),
      generatePresignedDownloadUrl: jest
        .fn()
        .mockResolvedValue('https://signed-url'),
    };
    service = new PayslipPdfService(itemRepo, payslipService, storage);
  });

  it('lazily renders a PDF to S3 when no key is stored, then returns a signed URL', async () => {
    const item = {
      id: 'item1',
      user_id: 'emp1',
      payslip_pdf_key: null as string | null,
    };
    itemRepo.findById.mockResolvedValue(item);

    const { url } = await service.getDownloadUrl(user, 'run1', 'item1');

    expect(url).toBe('https://signed-url');
    const [buffer, key, mime] = storage.uploadFile.mock.calls[0];
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(0);
    expect(key).toBe('payslips/org1/run1/item1.pdf');
    expect(mime).toBe('application/pdf');
    expect(item.payslip_pdf_key).toBe(key);
  });

  it('reuses the stored key without re-rendering', async () => {
    itemRepo.findById.mockResolvedValue({
      id: 'item1',
      payslip_pdf_key: 'payslips/org1/run1/item1.pdf',
    });

    await service.getDownloadUrl(user, 'run1', 'item1');

    expect(storage.uploadFile).not.toHaveBeenCalled();
    expect(payslipService.getPayslip).not.toHaveBeenCalled();
    expect(storage.generatePresignedDownloadUrl).toHaveBeenCalledWith(
      'payslips/org1/run1/item1.pdf',
    );
  });

  it('404s for an unknown item', async () => {
    itemRepo.findById.mockResolvedValue(null);

    await expect(
      service.getDownloadUrl(user, 'run1', 'missing'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('skips non-processed items when generating for a run', async () => {
    itemRepo.findAllByRun.mockResolvedValue([
      { id: 'a', item_status: PayrollItemStatus.ERROR },
      { id: 'b', item_status: PayrollItemStatus.PENDING },
    ]);

    await service.generateForRun(user, { id: 'run1' } as any);

    expect(storage.uploadFile).not.toHaveBeenCalled();
  });
});
