import { ConflictException, BadRequestException } from '@nestjs/common';
import { PayrollRunService } from './payroll-run.service';
import { FinancialMonth, PayrollRunStatus } from '../enums/payroll.enum';
import { LoggedInUser } from '../../auth/interfaces/logged-in-user.interface';

const user: LoggedInUser = {
  userId: 'u1',
  enterpriseId: 'ent1',
  organizationId: 'org1',
  appId: 'app1',
  isPlatformAdmin: false,
};

describe('PayrollRunService', () => {
  let runRepo: any;
  let itemRepo: any;
  let adjustmentRepo: any;
  let audit: any;
  let service: PayrollRunService;

  beforeEach(() => {
    runRepo = {
      findByPeriod: jest.fn(),
      findById: jest.fn(),
      list: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
    };
    itemRepo = { list: jest.fn(), findById: jest.fn(), findAllByRun: jest.fn() };
    adjustmentRepo = { listAllByRun: jest.fn() };
    audit = { record: jest.fn(), listForEntities: jest.fn() };
    service = new PayrollRunService(runRepo, itemRepo, adjustmentRepo, audit);
  });

  describe('createRun', () => {
    it('rejects a duplicate run for the same month/year', async () => {
      runRepo.findByPeriod.mockResolvedValue({ id: 'existing' });

      await expect(
        service.createRun(user, { month: FinancialMonth.APR, year: 2026 }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(runRepo.create).not.toHaveBeenCalled();
    });

    it('creates a draft run with computed pay-period dates and writes an audit entry', async () => {
      runRepo.findByPeriod.mockResolvedValue(null);
      runRepo.create.mockImplementation((p: any) => ({
        id: 'run1',
        run_status: PayrollRunStatus.DRAFT,
        ...p,
      }));

      const run = await service.createRun(user, {
        month: FinancialMonth.APR,
        year: 2026,
      });

      const payload = runRepo.create.mock.calls[0][0];
      expect(payload.pay_period_from.toISOString().slice(0, 10)).toBe('2026-04-01');
      expect(payload.pay_period_to.toISOString().slice(0, 10)).toBe('2026-04-30');
      expect(payload.total_working_days).toBe(30); // April
      expect(payload.organization_id).toBe('org1');
      expect(audit.record).toHaveBeenCalledTimes(1);
      expect(run.id).toBe('run1');
    });
  });

  describe('deleteRun', () => {
    it('refuses to delete a run that is not in Draft', async () => {
      runRepo.findById.mockResolvedValue({
        id: 'run1',
        run_status: PayrollRunStatus.LOCKED,
      });

      await expect(service.deleteRun(user, 'run1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(runRepo.remove).not.toHaveBeenCalled();
    });

    it('deletes a draft run and audits it', async () => {
      const run = { id: 'run1', run_status: PayrollRunStatus.DRAFT };
      runRepo.findById.mockResolvedValue(run);

      await service.deleteRun(user, 'run1');

      expect(audit.record).toHaveBeenCalledTimes(1);
      expect(runRepo.remove).toHaveBeenCalledWith(run);
    });
  });

  describe('getAuditTrail', () => {
    it('gathers run + item + adjustment ids and returns their audit entries', async () => {
      runRepo.findById.mockResolvedValue({ id: 'run1' });
      itemRepo.findAllByRun.mockResolvedValue([{ id: 'item1' }, { id: 'item2' }]);
      adjustmentRepo.listAllByRun.mockResolvedValue([{ id: 'adj1' }]);
      audit.listForEntities.mockResolvedValue([{ action: 'create' }]);

      const trail = await service.getAuditTrail(user, 'run1');

      expect(audit.listForEntities).toHaveBeenCalledWith('org1', [
        'run1',
        'item1',
        'item2',
        'adj1',
      ]);
      expect(trail).toHaveLength(1);
    });
  });
});
