import { BadRequestException, ConflictException } from '@nestjs/common';
import { PayrollProcessingService } from './payroll-processing.service';
import {
  PayrollItemStatus,
  PayrollRunStatus,
} from '../enums/payroll.enum';
import { LoggedInUser } from '../../auth/interfaces/logged-in-user.interface';

const user: LoggedInUser = {
  userId: 'u1',
  enterpriseId: 'ent1',
  organizationId: 'org1',
  appId: 'app1',
  isPlatformAdmin: false,
};

function makeItem(overrides: any = {}) {
  return {
    id: 'item1',
    user_id: 'emp1',
    payroll_run_id: 'run1',
    total_working_days: 30,
    lop_days: 3,
    present_days: 27,
    paid_leave_days: 0,
    item_status: PayrollItemStatus.PENDING,
    ...overrides,
  };
}

function makeEngineResult() {
  return {
    gross: 10000,
    deductions_total: 500,
    net: 9500,
    employer_contribution: 1200,
    earnings: [{ name: 'Basic', value: 10000, calculated_value: 10000 }],
    deductions: [{ name: 'Tax', value: 500, calculated_value: 500 }],
    warnings: [],
  };
}

describe('PayrollProcessingService', () => {
  let runRepo: any;
  let itemRepo: any;
  let adjustmentRepo: any;
  let reimbursementRepo: any;
  let salaryRepo: any;
  let calcEngine: any;
  let runService: any;
  let audit: any;
  let payslipPdf: any;
  let service: PayrollProcessingService;

  beforeEach(() => {
    runRepo = { save: jest.fn((r) => r) };
    itemRepo = {
      findAllByRun: jest.fn(),
      findById: jest.fn(),
      countByStatus: jest.fn(),
      save: jest.fn((i) => i),
    };
    adjustmentRepo = {
      sumForUser: jest.fn().mockResolvedValue({ bonus: 0, deduction: 0 }),
    };
    reimbursementRepo = {
      findIncludable: jest.fn().mockResolvedValue([]),
      stampProcessed: jest.fn(),
      releaseForUser: jest.fn(),
      markPaidForRun: jest.fn(),
    };
    salaryRepo = {
      findActiveSalary: jest.fn(),
      findSalaryWithComponents: jest.fn(),
    };
    calcEngine = { calculate: jest.fn() };
    runService = { getRun: jest.fn() };
    audit = { record: jest.fn() };
    payslipPdf = { generateForRun: jest.fn() };

    let notificationService: any = { send: jest.fn() };

    service = new PayrollProcessingService(
      runRepo,
      itemRepo,
      adjustmentRepo,
      reimbursementRepo,
      salaryRepo,
      calcEngine,
      runService,
      audit,
      payslipPdf,
      notificationService,
    );

    salaryRepo.findActiveSalary.mockResolvedValue({ id: 's1', ctc: 120000 });
    salaryRepo.findSalaryWithComponents.mockResolvedValue({
      components: [
        { component_type: 'earning', component_name: 'Basic', value: '10000' },
        { component_type: 'deduction', component_name: 'Tax', value: '500' },
      ],
    });
    calcEngine.calculate.mockResolvedValue(makeEngineResult());
  });

  describe('process', () => {
    it('feeds the attendance snapshot (LOP & working days) into the engine', async () => {
      runService.getRun.mockResolvedValue({
        id: 'run1',
        run_status: PayrollRunStatus.DRAFT,
      });
      itemRepo.findAllByRun.mockResolvedValue([makeItem()]);

      await service.process(user, 'run1');

      const [, , structure, dynamic] = calcEngine.calculate.mock.calls[0];
      expect(structure.earnings).toHaveLength(1);
      expect(structure.deductions).toHaveLength(1);
      expect(dynamic.lwp_days).toBe(3);
      expect(dynamic.total_working_days).toBe(30);
    });

    it('adds approved reimbursements on top of net and stamps them with the run id', async () => {
      runService.getRun.mockResolvedValue({
        id: 'run1',
        run_status: PayrollRunStatus.DRAFT,
      });
      const item = makeItem();
      itemRepo.findAllByRun.mockResolvedValue([item]);
      reimbursementRepo.findIncludable.mockResolvedValue([
        { id: 'r1', amount: '1000' },
        { id: 'r2', amount: '500' },
      ]);

      const result = await service.process(user, 'run1');

      expect(item.net).toBe(11000); // 9500 + 1500
      expect(item.reimbursement_total).toBe(1500);
      expect(item.item_status).toBe(PayrollItemStatus.PROCESSED);
      expect(reimbursementRepo.stampProcessed).toHaveBeenCalledWith(
        ['r1', 'r2'],
        'run1',
      );
      expect(result.processed).toBe(1);
      expect(result.errors).toBe(0);
    });

    it('marks an employee with no salary as ERROR and releases their reimbursements', async () => {
      runService.getRun.mockResolvedValue({
        id: 'run1',
        run_status: PayrollRunStatus.DRAFT,
      });
      const item = makeItem();
      itemRepo.findAllByRun.mockResolvedValue([item]);
      salaryRepo.findActiveSalary.mockResolvedValue(null);

      const result = await service.process(user, 'run1');

      expect(item.item_status).toBe(PayrollItemStatus.ERROR);
      expect(item.error_message).toMatch(/salary structure/i);
      expect(reimbursementRepo.releaseForUser).toHaveBeenCalledWith(
        'org1',
        'emp1',
        'run1',
      );
      expect(result.errors).toBe(1);
    });

    it('rolls up run totals and marks the run Completed', async () => {
      const run = { id: 'run1', run_status: PayrollRunStatus.DRAFT };
      runService.getRun.mockResolvedValue(run);
      itemRepo.findAllByRun.mockResolvedValue([makeItem()]);

      await service.process(user, 'run1');

      expect(run.run_status).toBe(PayrollRunStatus.COMPLETED);
      expect((run as any).total_net).toBe(9500);
      expect((run as any).processed_by).toBe('u1');
      expect(audit.record).toHaveBeenCalled();
    });

    it('refuses to process a locked run', async () => {
      runService.getRun.mockResolvedValue({
        id: 'run1',
        run_status: PayrollRunStatus.LOCKED,
      });

      await expect(service.process(user, 'run1')).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('refuses to process a run that is already processing (concurrency guard)', async () => {
      runService.getRun.mockResolvedValue({
        id: 'run1',
        run_status: PayrollRunStatus.PROCESSING,
      });

      await expect(service.process(user, 'run1')).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('refuses to process a run with no prepared items', async () => {
      runService.getRun.mockResolvedValue({
        id: 'run1',
        run_status: PayrollRunStatus.DRAFT,
      });
      itemRepo.findAllByRun.mockResolvedValue([]);

      await expect(service.process(user, 'run1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('lock', () => {
    beforeEach(() => {
      itemRepo.findAllByRun.mockResolvedValue([makeItem()]);
    });

    it('locks a completed run, marks reimbursements paid, and freezes it', async () => {
      const run = { id: 'run1', run_status: PayrollRunStatus.COMPLETED, total_net: 9500 };
      runService.getRun.mockResolvedValue(run);
      itemRepo.countByStatus.mockResolvedValue({
        [PayrollItemStatus.PENDING]: 0,
        [PayrollItemStatus.PROCESSED]: 1,
        [PayrollItemStatus.ERROR]: 0,
      });

      await service.lock(user, 'run1');

      expect(reimbursementRepo.markPaidForRun).toHaveBeenCalled();
      expect(run.run_status).toBe(PayrollRunStatus.LOCKED);
      expect((run as any).locked_by).toBe('u1');
      expect(payslipPdf.generateForRun).toHaveBeenCalledWith(user, run);
    });

    it('refuses to lock when items are still pending or in error', async () => {
      runService.getRun.mockResolvedValue({
        id: 'run1',
        run_status: PayrollRunStatus.COMPLETED,
      });
      itemRepo.countByStatus.mockResolvedValue({
        [PayrollItemStatus.PENDING]: 0,
        [PayrollItemStatus.PROCESSED]: 2,
        [PayrollItemStatus.ERROR]: 1,
      });

      await expect(service.lock(user, 'run1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(reimbursementRepo.markPaidForRun).not.toHaveBeenCalled();
    });

    it('refuses to lock a run that has not been processed', async () => {
      runService.getRun.mockResolvedValue({
        id: 'run1',
        run_status: PayrollRunStatus.DRAFT,
      });

      await expect(service.lock(user, 'run1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rejects locking an already-locked run', async () => {
      runService.getRun.mockResolvedValue({
        id: 'run1',
        run_status: PayrollRunStatus.LOCKED,
      });

      await expect(service.lock(user, 'run1')).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  describe('disburse', () => {
    it('marks processed items paid and flags the run fully disbursed', async () => {
      const run = {
        id: 'run1',
        run_status: PayrollRunStatus.LOCKED,
      } as any;
      runService.getRun.mockResolvedValue(run);
      const item = makeItem({ item_status: PayrollItemStatus.PROCESSED });
      itemRepo.findAllByRun.mockResolvedValue([item]);

      const result = await service.disburse(user, 'run1', { reference: 'UTR-99' });

      expect(item.payout_status).toBe('paid');
      expect(item.paid_at).toBeDefined();
      expect(run.is_disbursed).toBe(true);
      expect(run.disbursement_reference).toBe('UTR-99');
      expect(result.marked_paid).toBe(1);
      expect(audit.record).toHaveBeenCalled();
    });

    it('refuses to disburse a run that is not locked', async () => {
      runService.getRun.mockResolvedValue({
        id: 'run1',
        run_status: PayrollRunStatus.COMPLETED,
      });

      await expect(
        service.disburse(user, 'run1', {}),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
