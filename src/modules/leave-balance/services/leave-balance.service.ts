import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { LoggedInUser } from '../../auth/interfaces/logged-in-user.interface';
import { Status } from '../../../common/enums';
import { LeaveConfig } from '../../leave-config/entities/leave-config.entity';
import { LeaveType } from '../../leave-config/entities/leave-type.entity';
import { User } from '../../user/entities/user.entity';
import { LeaveBalance } from '../entities/leave-balance.entity';
import { LedgerDirection, LedgerEntryType } from '../enums';
import {
  BalanceListRow,
  LeaveBalanceRepository,
  ListBalanceFilters,
} from '../repositories/leave-balance.repository';
import { LeaveBalanceLedgerRepository } from '../repositories/leave-balance-ledger.repository';
import { AdjustBalanceDto } from '../dto/adjust-balance.dto';
import { BulkInitializeDto, BulkInitScope } from '../dto/bulk-initialize.dto';
import { InitializeBalanceDto } from '../dto/initialize-balance.dto';
import { LedgerQueryDto } from '../dto/ledger-query.dto';
import { LeaveRequest } from '../../leave-request/entities/leave-request.entity';
import { LeaveRequestStatus } from '../../leave-request/enums';

const LWP_CODE = 'LWP';

interface BalanceComputedFields {
  consumed_days: number | null;
  available_days: number | null;
}

export interface BalanceView {
  id: string | null;
  leave_type_id: string;
  leave_type_code: string | null;
  leave_type_name: string;
  is_unlimited: boolean;
  accrual?: string;
  allow_half_day?: boolean;
  allocated_days: number | null;
  accrued_days: number | null;
  carry_forward: number | null;
  adjustment: number | null;
  used_days: number;
  pending_days: number;
  consumed_days: number | null;
  available_days: number | null;
}

@Injectable()
export class LeaveBalanceService {
  private readonly logger = new Logger(LeaveBalanceService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly balanceRepo: LeaveBalanceRepository,
    private readonly ledgerRepo: LeaveBalanceLedgerRepository,
    @InjectRepository(LeaveConfig)
    private readonly leaveConfigRepo: Repository<LeaveConfig>,
    @InjectRepository(LeaveType)
    private readonly leaveTypeRepo: Repository<LeaveType>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(LeaveRequest)
    private readonly leaveRequestRepo: Repository<LeaveRequest>,
  ) {}

  // ─── Public: Initialization ────────────────────────────────────────────

  async initializeForEmployee(
    user: LoggedInUser,
    dto: InitializeBalanceDto,
  ): Promise<{
    employee_id: string;
    leave_year: number;
    balances: BalanceView[];
  }> {
    const employee = await this.findActiveEmployee(
      dto.employee_id,
      user.organizationId,
    );
    if (!employee) {
      throw new NotFoundException(`Employee ${dto.employee_id} not found`);
    }

    const exists = await this.balanceRepo.existsForEmployeeYear(
      dto.employee_id,
      dto.leave_year,
      user.organizationId,
    );
    if (exists) {
      throw new ConflictException(
        `ALREADY_INITIALIZED: balances already exist for employee ${dto.employee_id} in year ${dto.leave_year}`,
      );
    }

    const config = await this.requireActiveConfig(user.organizationId);
    const leaveTypes = await this.fetchAllocatableLeaveTypes(config.id);

    const cycle = this.computeCycle(dto.leave_year);
    const carryMap = new Map<string, number>(
      (dto.carry_forward ?? []).map((c) => [c.leave_type_id, c.days]),
    );

    const created = await this.dataSource.transaction(async (manager) => {
      const out: { balance: LeaveBalance; leaveType: LeaveType }[] = [];
      for (const lt of leaveTypes) {
        const allocated = lt.days;
        const accrued = this.computeAccruedDays(lt, dto.leave_year);
        const carry = carryMap.get(lt.id) ?? 0;

        const row = manager.create(LeaveBalance, {
          employee_id: dto.employee_id,
          leave_type_id: lt.id,
          leave_year: dto.leave_year,
          cycle_start: cycle.start,
          cycle_end: cycle.end,
          allocated_days: this.toDecimalStr(allocated),
          accrued_days: this.toDecimalStr(accrued),
          carry_forward: this.toDecimalStr(carry),
          adjustment: this.toDecimalStr(0),
          used_days: this.toDecimalStr(0),
          pending_days: this.toDecimalStr(0),
          is_unlimited: false,
          organization_id: user.organizationId,
          enterprise_id: user.enterpriseId,
          modified_by: user.userId,
          status: Status.ACTIVE,
        });

        const saved = await manager.save(row);
        out.push({ balance: saved, leaveType: lt });

        await this.ledgerRepo.append(
          {
            balance_id: saved.id,
            entry_type: LedgerEntryType.INITIAL_GRANT,
            direction: LedgerDirection.CREDIT,
            days: this.toDecimalStr(accrued),
            running_balance: this.toDecimalStr(accrued + carry),
            reason: 'Year start grant',
            organization_id: user.organizationId,
            enterprise_id: user.enterpriseId,
            modified_by: user.userId,
          },
          manager,
        );

        if (carry > 0) {
          await this.ledgerRepo.append(
            {
              balance_id: saved.id,
              entry_type: LedgerEntryType.CARRY_FORWARD,
              direction: LedgerDirection.CREDIT,
              days: this.toDecimalStr(carry),
              running_balance: this.toDecimalStr(accrued + carry),
              reason: 'Carry forward from previous year',
              organization_id: user.organizationId,
              enterprise_id: user.enterpriseId,
              modified_by: user.userId,
            },
            manager,
          );
        }
      }
      return out;
    });

    return {
      employee_id: dto.employee_id,
      leave_year: dto.leave_year,
      balances: created.map(({ balance, leaveType }) =>
        this.toBalanceView(balance, leaveType),
      ),
    };
  }

  async bulkInitialize(
    user: LoggedInUser,
    dto: BulkInitializeDto,
  ): Promise<{
    initialized_count: number;
    skipped: { employee_id: string; reason: string }[];
  }> {
    const employeeIds = await this.resolveBulkEmployeeIds(user, dto);

    let initialized = 0;
    const skipped: { employee_id: string; reason: string }[] = [];

    for (const employeeId of employeeIds) {
      const exists = await this.balanceRepo.existsForEmployeeYear(
        employeeId,
        dto.leave_year,
        user.organizationId,
      );
      if (exists) {
        skipped.push({
          employee_id: employeeId,
          reason: 'ALREADY_INITIALIZED',
        });
        continue;
      }
      try {
        const carry = dto.auto_carry_forward
          ? await this.computeAutoCarryForward(
              employeeId,
              dto.leave_year,
              user.organizationId,
            )
          : undefined;
        await this.initializeForEmployee(user, {
          employee_id: employeeId,
          leave_year: dto.leave_year,
          carry_forward: carry,
        });
        initialized += 1;
      } catch (err) {
        const code =
          err instanceof Error ? err.message.split(':')[0] : 'INIT_FAILED';
        skipped.push({ employee_id: employeeId, reason: code });
      }
    }

    return { initialized_count: initialized, skipped };
  }

  // ─── Public: Reads ─────────────────────────────────────────────────────

  async getMyBalance(
    user: LoggedInUser,
    leaveYear?: number,
  ): Promise<{
    employee_id: string;
    leave_year: number;
    leave_cycle: { start: string; end: string };
    total_allocated: number;
    total_available: number;
    balances: BalanceView[];
  }> {
    return this.getBalanceForEmployee(user, user.userId, leaveYear);
  }

  async getBalanceForEmployee(
    user: LoggedInUser,
    employeeId: string,
    leaveYear?: number,
  ): Promise<{
    employee_id: string;
    leave_year: number;
    leave_cycle: { start: string; end: string };
    total_allocated: number;
    total_available: number;
    balances: BalanceView[];
  }> {
    const year = leaveYear ?? this.currentLeaveYear();
    const cycle = this.computeCycle(year);

    const persisted = await this.balanceRepo.findForEmployee(
      employeeId,
      user.organizationId,
      year,
    );

    const lwpTypes = await this.findLwpLeaveTypes(user.organizationId);
    const persistedLwpTypeIds = new Set(
      persisted.filter((b) => b.is_unlimited).map((b) => b.leave_type_id),
    );

    const views: BalanceView[] = persisted.map((b) =>
      this.toBalanceView(b, b.leave_type),
    );

    for (const lwp of lwpTypes) {
      if (persistedLwpTypeIds.has(lwp.id)) continue;
      const usage = await this.aggregateRequestsForLwp(
        employeeId,
        lwp.id,
        year,
        user.organizationId,
      );
      views.push(this.synthesizeUnlimitedView(lwp, usage));
    }

    const totalAllocated = views
      .filter((v) => !v.is_unlimited && v.allocated_days !== null)
      .reduce((acc, v) => acc + (v.allocated_days ?? 0), 0);
    const totalAvailable = views
      .filter((v) => !v.is_unlimited && v.available_days !== null)
      .reduce((acc, v) => acc + (v.available_days ?? 0), 0);

    return {
      employee_id: employeeId,
      leave_year: year,
      leave_cycle: cycle,
      total_allocated: totalAllocated,
      total_available: totalAvailable,
      balances: views,
    };
  }

  async listBalances(
    user: LoggedInUser,
    filters: Omit<ListBalanceFilters, 'organizationId'>,
  ): Promise<{
    data: Array<{
      id: string;
      employee_id: string;
      employee_code: string | null;
      employee_name: string;
      department_name: string | null;
      leave_type_id: string;
      leave_type_code: string | null;
      leave_type_name: string;
      is_unlimited: boolean;
      leave_year: number;
      allocated_days: number | null;
      available_days: number | null;
      used_days: number;
      pending_days: number;
      consumed_days: number | null;
    }>;
    pagination: { page: number; limit: number; total: number };
  }> {
    const { rows, total } = await this.balanceRepo.list({
      ...filters,
      organizationId: user.organizationId,
    });

    return {
      data: rows.map((row) => this.toListRowView(row)),
      pagination: {
        page: filters.page ?? 1,
        limit: filters.limit ?? 20,
        total,
      },
    };
  }

  async getBalanceById(user: LoggedInUser, id: string): Promise<BalanceView> {
    const balance = await this.balanceRepo.findById(id, user.organizationId);
    if (!balance) {
      throw new NotFoundException(`BALANCE_NOT_FOUND: ${id}`);
    }
    return this.toBalanceView(balance, balance.leave_type);
  }

  async getLedger(
    user: LoggedInUser,
    balanceId: string,
    query: LedgerQueryDto,
  ): Promise<{
    data: Array<{
      id: string;
      balance_id: string;
      type: string;
      direction: string;
      days: number;
      running_balance: number | null;
      reference_id: string | null;
      reason: string | null;
      created_at: Date;
      modified_by: string | null;
    }>;
    pagination: { page: number; limit: number; total: number };
  }> {
    const balance = await this.balanceRepo.findById(
      balanceId,
      user.organizationId,
    );
    if (!balance) {
      throw new NotFoundException(`BALANCE_NOT_FOUND: ${balanceId}`);
    }

    const { data, total } = await this.ledgerRepo.list({
      balanceId,
      fromDate: query.from_date,
      toDate: query.to_date,
      page: query.page,
      limit: query.limit,
    });

    return {
      data: data.map((entry) => ({
        id: entry.id,
        balance_id: entry.balance_id,
        type: entry.entry_type,
        direction: entry.direction,
        days: Number(entry.days),
        running_balance:
          entry.running_balance === null ? null : Number(entry.running_balance),
        reference_id: entry.reference_id,
        reason: entry.reason,
        created_at: entry.created_at,
        modified_by: entry.modified_by,
      })),
      pagination: {
        page: query.page ?? 1,
        limit: query.limit ?? 50,
        total,
      },
    };
  }

  // ─── Public: Mutations ─────────────────────────────────────────────────

  async adjustBalance(
    user: LoggedInUser,
    id: string,
    dto: AdjustBalanceDto,
  ): Promise<{ id: string; available_days: number; ledger_entry_id: string }> {
    const balance = await this.balanceRepo.findById(id, user.organizationId);
    if (!balance) {
      throw new NotFoundException(`BALANCE_NOT_FOUND: ${id}`);
    }
    if (balance.is_unlimited) {
      throw new UnprocessableEntityException(
        'UNLIMITED_TYPE_NOT_ADJUSTABLE: cannot adjust unlimited leave balances',
      );
    }
    if (balance.status !== Status.ACTIVE) {
      throw new UnprocessableEntityException(
        'INACTIVE_BALANCE: cannot mutate this balance',
      );
    }
    if (dto.days % 0.5 !== 0) {
      throw new BadRequestException('days must be in 0.5 increments');
    }

    return this.dataSource.transaction(async (manager) => {
      const locked = await this.balanceRepo.lockOneByCompositeKey(
        balance.employee_id,
        balance.leave_type_id,
        balance.leave_year,
        user.organizationId,
        manager,
      );
      if (!locked) {
        throw new NotFoundException(`BALANCE_NOT_FOUND: ${id}`);
      }

      const signedDelta =
        dto.direction === LedgerDirection.CREDIT ? dto.days : -dto.days;
      const nextAdjustment = Number(locked.adjustment) + signedDelta;
      const projectedAvailable = this.computeAvailable({
        ...locked,
        adjustment: this.toDecimalStr(nextAdjustment),
      });
      if (projectedAvailable !== null && projectedAvailable < 0) {
        throw new UnprocessableEntityException(
          `INSUFFICIENT_BALANCE: debit would result in available_days=${projectedAvailable}`,
        );
      }

      await manager.update(LeaveBalance, locked.id, {
        adjustment: this.toDecimalStr(nextAdjustment),
        modified_by: user.userId,
      });

      const ledger = await this.ledgerRepo.append(
        {
          balance_id: locked.id,
          entry_type: LedgerEntryType.MANUAL_ADJUSTMENT,
          direction: dto.direction,
          days: this.toDecimalStr(dto.days),
          running_balance:
            projectedAvailable === null
              ? null
              : this.toDecimalStr(projectedAvailable),
          reason: dto.reason,
          organization_id: user.organizationId,
          enterprise_id: user.enterpriseId,
          modified_by: user.userId,
        },
        manager,
      );

      this.logger.log(
        `Balance ${locked.id} adjusted by ${user.userId}: ${dto.direction} ${dto.days} (reason: ${dto.reason})`,
      );

      return {
        id: locked.id,
        available_days: projectedAvailable ?? 0,
        ledger_entry_id: ledger.id,
      };
    });
  }

  async recompute(
    user: LoggedInUser,
    id: string,
  ): Promise<{
    id: string;
    before: {
      available_days: number | null;
      used_days: number;
      pending_days: number;
    };
    after: {
      available_days: number | null;
      used_days: number;
      pending_days: number;
    };
    drift_detected: boolean;
  }> {
    const balance = await this.balanceRepo.findById(id, user.organizationId);
    if (!balance) {
      throw new NotFoundException(`BALANCE_NOT_FOUND: ${id}`);
    }

    const before = {
      available_days: balance.is_unlimited
        ? null
        : this.computeAvailable(balance),
      used_days: Number(balance.used_days),
      pending_days: Number(balance.pending_days),
    };

    if (balance.is_unlimited) {
      return { id, before, after: before, drift_detected: false };
    }

    const aggregate = await this.aggregateRequestsForBalance(
      balance.employee_id,
      balance.leave_type_id,
      balance.leave_year,
      user.organizationId,
    );

    await this.balanceRepo.update(id, {
      used_days: this.toDecimalStr(aggregate.used),
      pending_days: this.toDecimalStr(aggregate.pending),
      modified_by: user.userId,
    });

    const refreshed = (await this.balanceRepo.findById(
      id,
      user.organizationId,
    ))!;
    const after = {
      available_days: this.computeAvailable(refreshed),
      used_days: Number(refreshed.used_days),
      pending_days: Number(refreshed.pending_days),
    };

    const drift =
      before.used_days !== after.used_days ||
      before.pending_days !== after.pending_days;
    return { id, before, after, drift_detected: drift };
  }

  // ─── Public: Internal primitives used by leave-request service ─────────

  async ensureBalanceForRequest(
    user: LoggedInUser,
    employeeId: string,
    leaveType: LeaveType,
    leaveYear: number,
    manager: EntityManager,
  ): Promise<LeaveBalance> {
    const isUnlimited = leaveType.code === LWP_CODE;
    const existing = await this.balanceRepo.lockOneByCompositeKey(
      employeeId,
      leaveType.id,
      leaveYear,
      user.organizationId,
      manager,
    );
    if (existing) return existing;

    const cycle = this.computeCycle(leaveYear);
    const created = manager.create(LeaveBalance, {
      employee_id: employeeId,
      leave_type_id: leaveType.id,
      leave_year: leaveYear,
      cycle_start: cycle.start,
      cycle_end: cycle.end,
      allocated_days: isUnlimited ? null : this.toDecimalStr(leaveType.days),
      accrued_days: isUnlimited
        ? null
        : this.toDecimalStr(this.computeAccruedDays(leaveType, leaveYear)),
      carry_forward: isUnlimited ? null : this.toDecimalStr(0),
      adjustment: this.toDecimalStr(0),
      used_days: this.toDecimalStr(0),
      pending_days: this.toDecimalStr(0),
      is_unlimited: isUnlimited,
      organization_id: user.organizationId,
      enterprise_id: user.enterpriseId,
      modified_by: user.userId,
      status: Status.ACTIVE,
    });
    const saved = await manager.save(created);
    await manager
      .createQueryBuilder(LeaveBalance, 'b')
      .setLock('pessimistic_write')
      .where('b.id = :id', { id: saved.id })
      .getOne();
    return saved;
  }

  computeAvailable(balance: LeaveBalance): number | null {
    if (balance.is_unlimited) return null;
    const accrued = Number(balance.accrued_days ?? 0);
    const carry = Number(balance.carry_forward ?? 0);
    const adj = Number(balance.adjustment);
    const used = Number(balance.used_days);
    const pending = Number(balance.pending_days);
    return Math.round((accrued + carry + adj - used - pending) * 100) / 100;
  }

  async writeLedger(
    manager: EntityManager,
    user: LoggedInUser,
    balance: LeaveBalance,
    entry_type: LedgerEntryType,
    direction: LedgerDirection,
    days: number,
    referenceId: string | null,
    reason: string | null,
    runningBalanceOverride?: number | null,
  ): Promise<void> {
    const running =
      runningBalanceOverride !== undefined
        ? runningBalanceOverride
        : this.computeAvailable(balance);
    await this.ledgerRepo.append(
      {
        balance_id: balance.id,
        entry_type,
        direction,
        days: this.toDecimalStr(days),
        running_balance: running === null ? null : this.toDecimalStr(running),
        reference_id: referenceId,
        reason,
        organization_id: user.organizationId,
        enterprise_id: user.enterpriseId,
        modified_by: user.userId,
      },
      manager,
    );
  }

  // ─── Helpers ────────────────────────────────────────────────────────────

  private async requireActiveConfig(
    organizationId: string,
  ): Promise<LeaveConfig> {
    const config = await this.leaveConfigRepo.findOne({
      where: { organization_id: organizationId, status: Status.ACTIVE },
    });
    if (!config) {
      throw new UnprocessableEntityException(
        'NO_ACTIVE_CONFIG: organization has no active leave configuration',
      );
    }
    return config;
  }

  private async fetchAllocatableLeaveTypes(
    configId: string,
  ): Promise<LeaveType[]> {
    const types = await this.leaveTypeRepo.find({
      where: { config_id: configId },
    });
    return types.filter((t) => t.code !== LWP_CODE);
  }

  private async findLwpLeaveTypes(
    organizationId: string,
  ): Promise<LeaveType[]> {
    return this.leaveTypeRepo
      .createQueryBuilder('lt')
      .innerJoin('leave_configs', 'lc', 'lc.id = lt.config_id')
      .where('lc.organization_id = :orgId', { orgId: organizationId })
      .andWhere('lt.code = :code', { code: LWP_CODE })
      .getMany();
  }

  private async aggregateRequestsForLwp(
    employeeId: string,
    leaveTypeId: string,
    leaveYear: number,
    organizationId: string,
  ): Promise<{ used: number; pending: number }> {
    return this.aggregateRequestsForBalance(
      employeeId,
      leaveTypeId,
      leaveYear,
      organizationId,
    );
  }

  private async aggregateRequestsForBalance(
    employeeId: string,
    leaveTypeId: string,
    leaveYear: number,
    organizationId: string,
  ): Promise<{ used: number; pending: number }> {
    const raw = await this.leaveRequestRepo
      .createQueryBuilder('r')
      .select(
        `COALESCE(SUM(CASE WHEN r.request_status = :pending THEN r.total_days ELSE 0 END),0)`,
        'pending',
      )
      .addSelect(
        `COALESCE(SUM(CASE WHEN r.request_status = :approved THEN r.total_days ELSE 0 END),0)`,
        'used',
      )
      .where('r.employee_id = :employeeId', { employeeId })
      .andWhere('r.leave_type_id = :leaveTypeId', { leaveTypeId })
      .andWhere('r.leave_year = :leaveYear', { leaveYear })
      .andWhere('r.organization_id = :organizationId', { organizationId })
      .setParameter('pending', LeaveRequestStatus.PENDING)
      .setParameter('approved', LeaveRequestStatus.APPROVED)
      .getRawOne<{ pending: string; used: string }>();
    return {
      used: Number(raw?.used ?? 0),
      pending: Number(raw?.pending ?? 0),
    };
  }

  private async findActiveEmployee(
    employeeId: string,
    organizationId: string,
  ): Promise<User | null> {
    return this.userRepo.findOne({
      where: {
        id: employeeId,
        organization_id: organizationId,
        status: Status.ACTIVE,
      },
    });
  }

  private async resolveBulkEmployeeIds(
    user: LoggedInUser,
    dto: BulkInitializeDto,
  ): Promise<string[]> {
    if (dto.scope === BulkInitScope.EMPLOYEES) {
      return dto.employee_ids ?? [];
    }
    const qb = this.userRepo
      .createQueryBuilder('u')
      .select('u.id', 'id')
      .where('u.organization_id = :orgId', { orgId: user.organizationId })
      .andWhere('u.status = :status', { status: Status.ACTIVE });
    if (dto.scope === BulkInitScope.DEPARTMENT) {
      qb.andWhere('u.department_id IN (:...deptIds)', {
        deptIds: dto.department_ids,
      });
    }
    const rows = await qb.getRawMany<{ id: string }>();
    return rows.map((r) => r.id);
  }

  private async computeAutoCarryForward(
    employeeId: string,
    targetYear: number,
    organizationId: string,
  ): Promise<{ leave_type_id: string; days: number }[]> {
    const previousYear = targetYear - 1;
    const prior = await this.balanceRepo.findForEmployee(
      employeeId,
      organizationId,
      previousYear,
    );
    return prior
      .filter((b) => !b.is_unlimited)
      .map((b) => ({
        leave_type_id: b.leave_type_id,
        days: Math.max(0, this.computeAvailable(b) ?? 0),
      }))
      .filter((c) => c.days > 0);
  }

  private computeAccruedDays(leaveType: LeaveType, leaveYear: number): number {
    if (leaveType.accrual !== 'monthly') {
      return leaveType.days;
    }
    const today = new Date();
    if (today.getFullYear() < leaveYear) return 0;
    if (today.getFullYear() > leaveYear) return leaveType.days;
    const monthsElapsed = today.getMonth() + 1;
    const accrued =
      Math.floor((monthsElapsed / 12) * leaveType.days * 100) / 100;
    return Math.min(leaveType.days, accrued);
  }

  private computeCycle(leaveYear: number): { start: string; end: string } {
    return {
      start: `${leaveYear}-01-01`,
      end: `${leaveYear}-12-31`,
    };
  }

  private currentLeaveYear(): number {
    return new Date().getFullYear();
  }

  private toDecimalStr(n: number): string {
    return n.toFixed(2);
  }

  private toBalanceView(
    balance: LeaveBalance,
    leaveType: LeaveType | null,
  ): BalanceView {
    if (balance.is_unlimited) {
      return this.toUnlimitedView(balance, leaveType);
    }
    const computed = this.computeBalanceFields(balance);
    return {
      id: balance.id,
      leave_type_id: balance.leave_type_id,
      leave_type_code: leaveType?.code ?? null,
      leave_type_name: leaveType?.name ?? '',
      is_unlimited: false,
      accrual: leaveType?.accrual,
      allow_half_day: leaveType?.allow_half_day,
      allocated_days:
        balance.allocated_days === null ? null : Number(balance.allocated_days),
      accrued_days:
        balance.accrued_days === null ? null : Number(balance.accrued_days),
      carry_forward:
        balance.carry_forward === null ? null : Number(balance.carry_forward),
      adjustment: Number(balance.adjustment),
      used_days: Number(balance.used_days),
      pending_days: Number(balance.pending_days),
      consumed_days: computed.consumed_days,
      available_days: computed.available_days,
    };
  }

  private toUnlimitedView(
    balance: LeaveBalance,
    leaveType: LeaveType | null,
  ): BalanceView {
    return {
      id: balance.id,
      leave_type_id: balance.leave_type_id,
      leave_type_code: leaveType?.code ?? LWP_CODE,
      leave_type_name: leaveType?.name ?? 'Loss of Pay',
      is_unlimited: true,
      accrual: leaveType?.accrual,
      allow_half_day: leaveType?.allow_half_day,
      allocated_days: null,
      accrued_days: null,
      carry_forward: null,
      adjustment: null,
      used_days: Number(balance.used_days),
      pending_days: Number(balance.pending_days),
      consumed_days: null,
      available_days: null,
    };
  }

  private synthesizeUnlimitedView(
    leaveType: LeaveType,
    usage: { used: number; pending: number },
  ): BalanceView {
    return {
      id: null,
      leave_type_id: leaveType.id,
      leave_type_code: leaveType.code ?? LWP_CODE,
      leave_type_name: leaveType.name,
      is_unlimited: true,
      accrual: leaveType.accrual,
      allow_half_day: leaveType.allow_half_day,
      allocated_days: null,
      accrued_days: null,
      carry_forward: null,
      adjustment: null,
      used_days: usage.used,
      pending_days: usage.pending,
      consumed_days: null,
      available_days: null,
    };
  }

  private computeBalanceFields(balance: LeaveBalance): BalanceComputedFields {
    const used = Number(balance.used_days);
    const pending = Number(balance.pending_days);
    return {
      consumed_days: Math.round((used + pending) * 100) / 100,
      available_days: this.computeAvailable(balance),
    };
  }

  private toListRowView(row: BalanceListRow): {
    id: string;
    employee_id: string;
    employee_code: string | null;
    employee_name: string;
    department_name: string | null;
    leave_type_id: string;
    leave_type_code: string | null;
    leave_type_name: string;
    is_unlimited: boolean;
    leave_year: number;
    allocated_days: number | null;
    available_days: number | null;
    used_days: number;
    pending_days: number;
    consumed_days: number | null;
  } {
    const view = this.toBalanceView(row.balance, row.balance.leave_type);
    const fullName = [
      row.employee_first_name,
      row.employee_middle_name,
      row.employee_last_name,
    ]
      .filter(Boolean)
      .join(' ');

    return {
      id: row.balance.id,
      employee_id: row.balance.employee_id,
      employee_code: row.employee_code,
      employee_name: fullName || 'Unknown',
      department_name: row.department_name,
      leave_type_id: view.leave_type_id,
      leave_type_code: view.leave_type_code,
      leave_type_name: view.leave_type_name,
      is_unlimited: view.is_unlimited,
      leave_year: row.balance.leave_year,
      allocated_days: view.allocated_days,
      available_days: view.available_days,
      used_days: view.used_days,
      pending_days: view.pending_days,
      consumed_days: view.consumed_days,
    };
  }
}
