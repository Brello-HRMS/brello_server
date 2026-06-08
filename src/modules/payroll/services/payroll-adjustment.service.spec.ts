import { ConflictException, NotFoundException } from '@nestjs/common';
import { PayrollAdjustmentService } from './payroll-adjustment.service';
import { AdjustmentType, PayrollRunStatus } from '../enums/payroll.enum';
import { LoggedInUser } from '../../auth/interfaces/logged-in-user.interface';

const user: LoggedInUser = {
  userId: 'u1',
  enterpriseId: 'ent1',
  organizationId: 'org1',
  appId: 'app1',
  isPlatformAdmin: false,
};

describe('PayrollAdjustmentService', () => {
  let adjustmentRepo: any;
  let itemRepo: any;
  let runService: any;
  let audit: any;
  let service: PayrollAdjustmentService;

  beforeEach(() => {
    adjustmentRepo = {
      create: jest.fn((d) => d),
      save: jest.fn((a) => ({ id: 'adj1', ...a })),
      findById: jest.fn(),
      remove: jest.fn(),
    };
    itemRepo = { findById: jest.fn() };
    runService = { getRun: jest.fn() };
    audit = { record: jest.fn() };
    service = new PayrollAdjustmentService(
      adjustmentRepo,
      itemRepo,
      runService,
      audit,
    );
  });

  const dto = {
    adjustment_type: AdjustmentType.BONUS,
    amount: 5000,
    reason: 'Diwali bonus',
  };

  it('adds an adjustment against the item owner and audits it', async () => {
    runService.getRun.mockResolvedValue({
      id: 'run1',
      run_status: PayrollRunStatus.DRAFT,
    });
    itemRepo.findById.mockResolvedValue({ id: 'item1', user_id: 'emp1' });

    const saved = await service.addAdjustment(user, 'run1', 'item1', dto);

    expect(adjustmentRepo.create.mock.calls[0][0].user_id).toBe('emp1');
    expect(adjustmentRepo.save).toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalled();
    expect(saved.id).toBe('adj1');
  });

  it('blocks adding an adjustment to a locked run', async () => {
    runService.getRun.mockResolvedValue({
      id: 'run1',
      run_status: PayrollRunStatus.LOCKED,
    });

    await expect(
      service.addAdjustment(user, 'run1', 'item1', dto),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(adjustmentRepo.save).not.toHaveBeenCalled();
  });

  it('404s when the target item does not exist', async () => {
    runService.getRun.mockResolvedValue({
      id: 'run1',
      run_status: PayrollRunStatus.DRAFT,
    });
    itemRepo.findById.mockResolvedValue(null);

    await expect(
      service.addAdjustment(user, 'run1', 'missing', dto),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('blocks removing an adjustment from a locked run', async () => {
    runService.getRun.mockResolvedValue({
      id: 'run1',
      run_status: PayrollRunStatus.LOCKED,
    });

    await expect(
      service.removeAdjustment(user, 'run1', 'adj1'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(adjustmentRepo.remove).not.toHaveBeenCalled();
  });
});
