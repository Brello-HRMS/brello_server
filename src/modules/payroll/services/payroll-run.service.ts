import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { LoggedInUser } from '../../auth/interfaces/logged-in-user.interface';
import { PayrollRunRepository } from '../repositories/payroll-run.repository';
import { PayrollRunItemRepository } from '../repositories/payroll-run-item.repository';
import { PayrollAdjustmentRepository } from '../repositories/payroll-adjustment.repository';
import { PayrollRun } from '../entities/payroll-run.entity';
import { PayrollRunItem } from '../entities/payroll-run-item.entity';
import {
  CreatePayrollRunDto,
  PayrollRunQueryDto,
  RunItemsQueryDto,
} from '../dto/payroll-run.dto';
import {
  AuditAction,
  FinancialMonth,
  PayrollRunStatus,
} from '../enums/payroll.enum';
import { AuditContextService } from '../../audit/services/audit-context.service';

const MONTH_ORDER: FinancialMonth[] = [
  FinancialMonth.JAN,
  FinancialMonth.FEB,
  FinancialMonth.MAR,
  FinancialMonth.APR,
  FinancialMonth.MAY,
  FinancialMonth.JUN,
  FinancialMonth.JUL,
  FinancialMonth.AUG,
  FinancialMonth.SEP,
  FinancialMonth.OCT,
  FinancialMonth.NOV,
  FinancialMonth.DEC,
];

@Injectable()
export class PayrollRunService {
  private readonly logger = new Logger(PayrollRunService.name);

  constructor(
    private readonly runRepo: PayrollRunRepository,
    private readonly itemRepo: PayrollRunItemRepository,
    private readonly adjustmentRepo: PayrollAdjustmentRepository,
    private readonly auditContext: AuditContextService,
  ) {}

  /**
   * Creates a Draft payroll run for a given month/year. Rejects duplicates —
   * a single run per (organization, month, year) is enforced at the DB level
   * and pre-checked here for a friendly error.
   */
  async createRun(
    user: LoggedInUser,
    dto: CreatePayrollRunDto,
  ): Promise<PayrollRun> {
    const existing = await this.runRepo.findByPeriod(
      user.organizationId,
      dto.year,
      dto.month,
    );
    if (existing) {
      throw new ConflictException(
        `A payroll run already exists for ${dto.month.toUpperCase()} ${dto.year}.`,
      );
    }

    const monthIdx = MONTH_ORDER.indexOf(dto.month);
    const periodFrom = new Date(Date.UTC(dto.year, monthIdx, 1));
    const periodTo = new Date(Date.UTC(dto.year, monthIdx + 1, 0)); // last day of month
    const daysInMonth = periodTo.getUTCDate();

    const run = await this.runRepo.create({
      enterprise_id: user.enterpriseId,
      organization_id: user.organizationId,
      month: dto.month,
      year: dto.year,
      pay_period_from: periodFrom,
      pay_period_to: periodTo,
      // Placeholder: refined during prepare to exclude weekly-offs/holidays.
      total_working_days: daysInMonth,
      modified_by: user.userId,
    });

    this.logger.log(
      `Payroll run ${run.id} created for ${dto.month} ${dto.year} by ${user.userId}`,
    );
    return run;
  }

  async listRuns(
    user: LoggedInUser,
    query: PayrollRunQueryDto,
  ): Promise<PayrollRun[]> {
    return this.runRepo.list(user.enterpriseId, user.organizationId, {
      status: query.status,
      year: query.year,
    });
  }

  async getRun(user: LoggedInUser, id: string): Promise<PayrollRun> {
    const run = await this.runRepo.findById(user.organizationId, id);
    if (!run) {
      throw new NotFoundException('Payroll run not found.');
    }
    return run;
  }

  /** Paginated per-employee items for a run (employee table). */
  async listItems(
    user: LoggedInUser,
    runId: string,
    query: RunItemsQueryDto,
  ) {
    await this.getRun(user, runId);
    const { data, total } = await this.itemRepo.list(runId, {
      status: query.status,
      page: query.page ?? 1,
      limit: query.limit ?? 50,
    });
    return {
      data,
      pagination: {
        page: query.page ?? 1,
        limit: query.limit ?? 50,
        total,
      },
    };
  }

  /** Single employee's payroll detail within a run. */
  async getItem(
    user: LoggedInUser,
    runId: string,
    itemId: string,
  ): Promise<PayrollRunItem> {
    await this.getRun(user, runId);
    const item = await this.itemRepo.findById(
      user.organizationId,
      runId,
      itemId,
    );
    if (!item) {
      throw new NotFoundException('Payroll item not found.');
    }
    return item;
  }


  /**
   * Discards a Draft run (and cascades its items/adjustments). Only Draft runs
   * may be deleted — once processing has begun or the run is locked, it is
   * immutable.
   */
  async deleteRun(user: LoggedInUser, id: string): Promise<void> {
    const run = await this.getRun(user, id);

    if (run.run_status !== PayrollRunStatus.DRAFT) {
      throw new BadRequestException(
        `Only Draft payroll runs can be deleted. This run is ${run.run_status}.`,
      );
    }

    this.auditContext.setPreValue(run as unknown as Record<string, unknown>);

    await this.runRepo.remove(run);
    this.logger.log(`Payroll run ${id} deleted by ${user.userId}`);
  }
}
