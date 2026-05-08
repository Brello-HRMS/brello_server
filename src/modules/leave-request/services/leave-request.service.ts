import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { LoggedInUser } from '../../auth/interfaces/logged-in-user.interface';
import { Status } from '../../../common/enums';
import { LeaveType } from '../../leave-config/entities/leave-type.entity';
import { LeaveConfig } from '../../leave-config/entities/leave-config.entity';
import { LeaveRules } from '../../leave-config/entities/leave-rules.entity';
import { User } from '../../user/entities/user.entity';
import { LeaveBalanceService } from '../../leave-balance/services/leave-balance.service';
import { LedgerDirection, LedgerEntryType } from '../../leave-balance/enums';
import { LeaveBalance } from '../../leave-balance/entities/leave-balance.entity';
import {
  LeaveRequest,
  LeaveRulesSnapshot,
} from '../entities/leave-request.entity';
import { HalfDaySlot, LeaveRequestStatus } from '../enums';
import { LeaveRequestRepository } from '../repositories/leave-request.repository';
import { LeaveRequestHistoryRepository } from '../repositories/leave-request-history.repository';
import { CreateLeaveRequestDto } from '../dto/create-leave-request.dto';
import { UpdateLeaveRequestDto } from '../dto/update-leave-request.dto';
import { ApproveRequestDto } from '../dto/approve-request.dto';
import { RejectRequestDto } from '../dto/reject-request.dto';
import { CancelRequestDto } from '../dto/cancel-request.dto';
import { AdminCancelRequestDto } from '../dto/admin-cancel-request.dto';
import { ListLeaveRequestQueryDto } from '../dto/list-leave-request-query.dto';

const LWP_CODE = 'LWP';

export interface DaysBreakdown {
  calendar_days: number;
  weekends: number;
  holidays: number;
  sandwich_days_added: number;
  billable_days: number;
}

interface ValidationContext {
  leaveType: LeaveType;
  rules: LeaveRules | null;
  config: LeaveConfig;
  breakdown: DaysBreakdown;
  totalDays: number;
  leaveYear: number;
}

@Injectable()
export class LeaveRequestService {
  private readonly logger = new Logger(LeaveRequestService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly requestRepo: LeaveRequestRepository,
    private readonly historyRepo: LeaveRequestHistoryRepository,
    private readonly balanceService: LeaveBalanceService,
    @InjectRepository(LeaveType)
    private readonly leaveTypeRepo: Repository<LeaveType>,
    @InjectRepository(LeaveConfig)
    private readonly leaveConfigRepo: Repository<LeaveConfig>,
    @InjectRepository(LeaveRules)
    private readonly leaveRulesRepo: Repository<LeaveRules>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  // ─── Public: Create / Submit / Update / Cancel / Delete ────────────────

  async create(
    user: LoggedInUser,
    dto: CreateLeaveRequestDto,
  ): Promise<{
    id: string;
    status: LeaveRequestStatus;
    leave_type_id: string;
    leave_type_name: string;
    from_date: string;
    to_date: string;
    is_half_day: boolean;
    total_days: number;
    computed_days_breakdown: DaysBreakdown;
    submitted_at: Date | null;
  }> {
    const ctx = await this.buildContext(
      user,
      dto.leave_type_id,
      dto.from_date,
      dto.to_date,
      dto.is_half_day,
    );
    this.validateBasicShape(dto, ctx);

    const submit = dto.submit !== false;

    if (submit) {
      await this.validateForSubmit(user, dto, ctx, undefined);
    }

    return this.dataSource.transaction(async (manager) => {
      const created = manager.create(LeaveRequest, {
        employee_id: user.userId,
        leave_type_id: dto.leave_type_id,
        leave_year: ctx.leaveYear,
        from_date: dto.from_date,
        to_date: dto.to_date,
        is_half_day: dto.is_half_day ?? false,
        half_day_slot: dto.half_day_slot ?? null,
        total_days: ctx.totalDays.toFixed(2),
        computed_days_breakdown: ctx.breakdown,
        reason: dto.reason,
        attachment_ids: dto.attachment_ids ?? [],
        request_status: submit
          ? LeaveRequestStatus.PENDING
          : LeaveRequestStatus.DRAFT,
        rules_snapshot: submit ? this.snapshotRules(ctx.rules) : null,
        submitted_at: submit ? new Date() : null,
        organization_id: user.organizationId,
        enterprise_id: user.enterpriseId,
        modified_by: user.userId,
        status: Status.ACTIVE,
      });
      const saved = await manager.save(created);

      await this.historyRepo.append(
        {
          leave_request_id: saved.id,
          from_status: null,
          to_status: LeaveRequestStatus.DRAFT,
          actor_id: user.userId,
          organization_id: user.organizationId,
          enterprise_id: user.enterpriseId,
          modified_by: user.userId,
        },
        manager,
      );

      if (submit) {
        await this.holdBalance(manager, user, saved, ctx);
        await this.historyRepo.append(
          {
            leave_request_id: saved.id,
            from_status: LeaveRequestStatus.DRAFT,
            to_status: LeaveRequestStatus.PENDING,
            actor_id: user.userId,
            organization_id: user.organizationId,
            enterprise_id: user.enterpriseId,
            modified_by: user.userId,
          },
          manager,
        );
      }

      this.logger.log(
        `Leave request ${saved.id} created (status=${saved.request_status}) by ${user.userId}`,
      );

      return {
        id: saved.id,
        status: saved.request_status,
        leave_type_id: saved.leave_type_id,
        leave_type_name: ctx.leaveType.name,
        from_date: saved.from_date,
        to_date: saved.to_date,
        is_half_day: saved.is_half_day,
        total_days: Number(saved.total_days),
        computed_days_breakdown: ctx.breakdown,
        submitted_at: saved.submitted_at,
      };
    });
  }

  async validate(
    user: LoggedInUser,
    dto: CreateLeaveRequestDto,
  ): Promise<{
    is_valid: boolean;
    computed_days_breakdown?: DaysBreakdown;
    balance_before?: number | null;
    balance_after?: number | null;
    warnings?: { code: string; message: string }[];
    errors?: { code: string; message: string }[];
  }> {
    try {
      const ctx = await this.buildContext(
        user,
        dto.leave_type_id,
        dto.from_date,
        dto.to_date,
        dto.is_half_day,
      );
      this.validateBasicShape(dto, ctx);
      await this.validateForSubmit(user, dto, ctx, undefined);

      const balance = await this.fetchBalance(
        user,
        user.userId,
        ctx.leaveType,
        ctx.leaveYear,
      );
      const before = balance
        ? this.balanceService.computeAvailable(balance)
        : null;
      const isLwp = ctx.leaveType.code === LWP_CODE;
      const after =
        isLwp || before === null
          ? null
          : Math.round((before - ctx.totalDays) * 100) / 100;

      return {
        is_valid: true,
        computed_days_breakdown: ctx.breakdown,
        balance_before: isLwp ? null : before,
        balance_after: after,
        warnings: isLwp
          ? [{ code: 'UNPAID_LEAVE', message: 'These days will be unpaid.' }]
          : [],
      };
    } catch (err) {
      const code = this.errorCodeOf(err);
      const message = err instanceof Error ? err.message : 'Validation failed';
      return {
        is_valid: false,
        errors: [{ code, message }],
      };
    }
  }

  async updateMine(
    user: LoggedInUser,
    id: string,
    dto: UpdateLeaveRequestDto,
  ): Promise<{ id: string; status: LeaveRequestStatus }> {
    const request = await this.requireOwn(user, id);

    if (
      request.request_status === LeaveRequestStatus.APPROVED ||
      request.request_status === LeaveRequestStatus.REJECTED ||
      request.request_status === LeaveRequestStatus.CANCELLED
    ) {
      throw new UnprocessableEntityException(
        `INVALID_STATE: cannot edit request in status ${request.request_status}`,
      );
    }

    if (request.request_status === LeaveRequestStatus.PENDING) {
      const allowed: (keyof UpdateLeaveRequestDto)[] = [
        'reason',
        'attachment_ids',
      ];
      const dtoKeys = Object.keys(dto) as (keyof UpdateLeaveRequestDto)[];
      const disallowed = dtoKeys.filter(
        (k) => dto[k] !== undefined && !allowed.includes(k),
      );
      if (disallowed.length > 0) {
        throw new UnprocessableEntityException(
          `INVALID_STATE: only reason/attachment_ids editable on PENDING (rejected: ${disallowed.join(',')})`,
        );
      }
      await this.requestRepo.update(id, {
        ...(dto.reason !== undefined && { reason: dto.reason }),
        ...(dto.attachment_ids !== undefined && {
          attachment_ids: dto.attachment_ids,
        }),
        modified_by: user.userId,
      });
      return { id, status: request.request_status };
    }

    const fromDate = dto.from_date ?? request.from_date;
    const toDate = dto.to_date ?? request.to_date;
    const leaveTypeId = dto.leave_type_id ?? request.leave_type_id;
    const isHalfDay = dto.is_half_day ?? request.is_half_day;

    const ctx = await this.buildContext(
      user,
      leaveTypeId,
      fromDate,
      toDate,
      isHalfDay,
    );
    const merged: CreateLeaveRequestDto = {
      leave_type_id: leaveTypeId,
      from_date: fromDate,
      to_date: toDate,
      is_half_day: isHalfDay,
      half_day_slot: dto.half_day_slot ?? request.half_day_slot ?? undefined,
      reason: dto.reason ?? request.reason,
      attachment_ids: dto.attachment_ids ?? request.attachment_ids,
    };
    this.validateBasicShape(merged, ctx);

    await this.requestRepo.update(id, {
      leave_type_id: leaveTypeId,
      leave_year: ctx.leaveYear,
      from_date: fromDate,
      to_date: toDate,
      is_half_day: isHalfDay,
      half_day_slot: merged.half_day_slot ?? null,
      total_days: ctx.totalDays.toFixed(2),
      computed_days_breakdown: ctx.breakdown,
      ...(merged.reason !== undefined && { reason: merged.reason }),
      ...(dto.attachment_ids !== undefined && {
        attachment_ids: dto.attachment_ids,
      }),
      modified_by: user.userId,
    });

    return { id, status: LeaveRequestStatus.DRAFT };
  }

  async submitDraft(
    user: LoggedInUser,
    id: string,
  ): Promise<{
    id: string;
    status: LeaveRequestStatus;
    submitted_at: Date;
  }> {
    const request = await this.requireOwn(user, id);
    if (request.request_status !== LeaveRequestStatus.DRAFT) {
      throw new UnprocessableEntityException(
        `INVALID_STATE: only DRAFT can be submitted (current: ${request.request_status})`,
      );
    }

    const ctx = await this.buildContext(
      user,
      request.leave_type_id,
      request.from_date,
      request.to_date,
      request.is_half_day,
    );
    const dtoForValidation: CreateLeaveRequestDto = {
      leave_type_id: request.leave_type_id,
      from_date: request.from_date,
      to_date: request.to_date,
      is_half_day: request.is_half_day,
      half_day_slot: request.half_day_slot ?? undefined,
      reason: request.reason,
    };
    await this.validateForSubmit(user, dtoForValidation, ctx, request.id);

    return this.dataSource.transaction(async (manager) => {
      const submittedAt = new Date();
      await manager.update(LeaveRequest, id, {
        request_status: LeaveRequestStatus.PENDING,
        submitted_at: submittedAt,
        rules_snapshot: this.snapshotRules(ctx.rules),
        total_days: ctx.totalDays.toFixed(2),
        computed_days_breakdown: ctx.breakdown,
        modified_by: user.userId,
      });

      const refreshed = (await manager.findOne(LeaveRequest, {
        where: { id },
      }))!;
      await this.holdBalance(manager, user, refreshed, ctx);

      await this.historyRepo.append(
        {
          leave_request_id: id,
          from_status: LeaveRequestStatus.DRAFT,
          to_status: LeaveRequestStatus.PENDING,
          actor_id: user.userId,
          organization_id: user.organizationId,
          enterprise_id: user.enterpriseId,
          modified_by: user.userId,
        },
        manager,
      );

      return {
        id,
        status: LeaveRequestStatus.PENDING,
        submitted_at: submittedAt,
      };
    });
  }

  async cancelMine(
    user: LoggedInUser,
    id: string,
    dto: CancelRequestDto,
  ): Promise<{
    id: string;
    status: LeaveRequestStatus;
    cancelled_at: Date;
    released_days: number;
  }> {
    const request = await this.requireOwn(user, id);
    return this.cancelInternal(user, request, dto.reason, false);
  }

  async deleteDraft(user: LoggedInUser, id: string): Promise<void> {
    const request = await this.requireOwn(user, id);
    if (request.request_status !== LeaveRequestStatus.DRAFT) {
      throw new UnprocessableEntityException(
        `INVALID_STATE: only DRAFT can be deleted (current: ${request.request_status})`,
      );
    }
    await this.requestRepo.hardDelete(id);
  }

  // ─── Public: Read ──────────────────────────────────────────────────────

  async listMine(
    user: LoggedInUser,
    query: ListLeaveRequestQueryDto,
  ): Promise<{
    data: ReturnType<LeaveRequestService['toListRowMine']>[];
    pagination: { page: number; limit: number; total: number };
  }> {
    const { data, total } = await this.requestRepo.listMine({
      organizationId: user.organizationId,
      employeeId: user.userId,
      statuses: query.status,
      leaveTypeId: query.leave_type_id,
      fromDate: query.from_date,
      toDate: query.to_date,
      page: query.page,
      limit: query.limit,
      sortBy: query.sort_by,
      sortOrder: query.sort_order,
    });

    const rows = data.map((r) => this.toListRowMine(r));

    return {
      data: rows,
      pagination: { page: query.page ?? 1, limit: query.limit ?? 20, total },
    };
  }

  async listAll(
    user: LoggedInUser,
    query: ListLeaveRequestQueryDto,
  ): Promise<{
    data: ReturnType<LeaveRequestService['toListRowHr']>[];
    pagination: { page: number; limit: number; total: number };
  }> {
    const { rows, total } = await this.requestRepo.list({
      organizationId: user.organizationId,
      statuses: query.status,
      employeeId: query.employee_id,
      search: query.search,
      departmentId: query.department_id,
      leaveTypeId: query.leave_type_id,
      fromDate: query.from_date,
      toDate: query.to_date,
      submittedFrom: query.submitted_from,
      submittedTo: query.submitted_to,
      page: query.page,
      limit: query.limit,
      sortBy: query.sort_by,
      sortOrder: query.sort_order,
    });

    return {
      data: rows.map((row) => this.toListRowHr(row)),
      pagination: { page: query.page ?? 1, limit: query.limit ?? 20, total },
    };
  }

  async pendingApprovals(user: LoggedInUser, query: ListLeaveRequestQueryDto) {
    return this.listAll(user, {
      ...query,
      status: [LeaveRequestStatus.PENDING],
    });
  }

  async getById(
    user: LoggedInUser,
    id: string,
  ): Promise<{
    id: string;
    status: LeaveRequestStatus;
    employee: { id: string; name: string; department_name: string | null };
    leave_type: { id: string; name: string };
    from_date: string;
    to_date: string;
    is_half_day: boolean;
    half_day_slot: HalfDaySlot | null;
    total_days: number;
    reason: string;
    attachment_ids: string[];
    computed_days_breakdown: DaysBreakdown | null;
    submitted_at: Date | null;
    approved_by: string | null;
    approved_by_name: string | null;
    approved_at: Date | null;
    approver_comment: string | null;
    rejection_reason: string | null;
    cancelled_at: Date | null;
    cancelled_by_admin: boolean;
    balance_snapshot_at_approval: LeaveRequest['balance_snapshot_at_approval'];
  }> {
    const request = await this.requestRepo.findById(id, user.organizationId);
    if (!request) {
      throw new NotFoundException(`REQUEST_NOT_FOUND: ${id}`);
    }
    const employee = await this.userRepo.findOne({
      where: { id: request.employee_id },
      relations: ['department'],
    });
    const approver = request.approved_by
      ? await this.userRepo.findOne({ where: { id: request.approved_by } })
      : null;

    return {
      id: request.id,
      status: request.request_status,
      employee: {
        id: request.employee_id,
        name: employee?.fullName ?? 'Unknown',
        department_name: employee?.department?.name ?? null,
      },
      leave_type: {
        id: request.leave_type_id,
        name: request.leave_type?.name ?? '',
      },
      from_date: request.from_date,
      to_date: request.to_date,
      is_half_day: request.is_half_day,
      half_day_slot: request.half_day_slot,
      total_days: Number(request.total_days),
      reason: request.reason,
      attachment_ids: request.attachment_ids ?? [],
      computed_days_breakdown: request.computed_days_breakdown,
      submitted_at: request.submitted_at,
      approved_by: request.approved_by,
      approved_by_name: approver?.fullName ?? null,
      approved_at: request.approved_at,
      approver_comment: request.approver_comment,
      rejection_reason: request.rejection_reason,
      cancelled_at: request.cancelled_at,
      cancelled_by_admin: request.cancelled_by_admin,
      balance_snapshot_at_approval: request.balance_snapshot_at_approval,
    };
  }

  async getHistory(
    user: LoggedInUser,
    id: string,
  ): Promise<
    Array<{
      id: string;
      from_status: LeaveRequestStatus | null;
      to_status: LeaveRequestStatus;
      actor_id: string;
      actor_name: string | null;
      comment: string | null;
      created_at: Date;
    }>
  > {
    const request = await this.requestRepo.findById(id, user.organizationId);
    if (!request) throw new NotFoundException(`REQUEST_NOT_FOUND: ${id}`);

    const entries = await this.historyRepo.findByRequest(id);
    const actorIds = [...new Set(entries.map((e) => e.actor_id))];
    const actors = actorIds.length
      ? await this.userRepo.find({
          where: actorIds.map((aid) => ({ id: aid })),
        })
      : [];
    const actorMap = new Map(actors.map((u) => [u.id, u.fullName]));

    return entries.map((e) => ({
      id: e.id,
      from_status: e.from_status,
      to_status: e.to_status,
      actor_id: e.actor_id,
      actor_name: actorMap.get(e.actor_id) ?? null,
      comment: e.comment,
      created_at: e.created_at,
    }));
  }

  // ─── Public: Approver / HR transitions ─────────────────────────────────

  async approve(
    user: LoggedInUser,
    id: string,
    dto: ApproveRequestDto,
  ): Promise<{
    id: string;
    status: LeaveRequestStatus;
    approved_at: Date;
    approved_by: string;
    balance_after: { leave_type_id: string; available_days: number | null };
  }> {
    return this.dataSource.transaction(async (manager) => {
      const request = await this.requestRepo.lockById(id, manager);
      if (!request || request.organization_id !== user.organizationId) {
        throw new NotFoundException(`REQUEST_NOT_FOUND: ${id}`);
      }
      if (request.employee_id === user.userId) {
        throw new ForbiddenException('SELF_APPROVAL_FORBIDDEN');
      }
      if (request.request_status !== LeaveRequestStatus.PENDING) {
        throw new UnprocessableEntityException(
          `INVALID_STATE: only PENDING can be approved (current: ${request.request_status})`,
        );
      }

      const isLwp = request.leave_type?.code === LWP_CODE;
      const balance = await this.balanceService.ensureBalanceForRequest(
        user,
        request.employee_id,
        request.leave_type,
        request.leave_year,
        manager,
      );

      const totalDays = Number(request.total_days);

      if (!isLwp) {
        const projected = this.balanceService.computeAvailable(balance) ?? 0;
        const projectedAfterMove =
          Math.round((projected + totalDays) * 100) / 100;
        const accrued = Number(balance.accrued_days ?? 0);
        const carry = Number(balance.carry_forward ?? 0);
        const adj = Number(balance.adjustment);
        const newUsed = Number(balance.used_days) + totalDays;
        const newAvailableAfterApprove =
          Math.round(
            (accrued +
              carry +
              adj -
              newUsed -
              (Number(balance.pending_days) - totalDays)) *
              100,
          ) / 100;
        if (newAvailableAfterApprove < 0) {
          throw new UnprocessableEntityException(
            `INSUFFICIENT_BALANCE_AT_APPROVAL: available would be ${newAvailableAfterApprove}`,
          );
        }
        void projectedAfterMove;
      }

      const newPending = Math.max(0, Number(balance.pending_days) - totalDays);
      const newUsed = Number(balance.used_days) + totalDays;
      await manager.update(LeaveBalance, balance.id, {
        pending_days: newPending.toFixed(2),
        used_days: newUsed.toFixed(2),
        modified_by: user.userId,
      });

      const refreshedBalance = (await manager.findOne(LeaveBalance, {
        where: { id: balance.id },
      }))!;
      const availableAfter = isLwp
        ? null
        : this.balanceService.computeAvailable(refreshedBalance);

      const approvedAt = new Date();
      await manager.update(LeaveRequest, id, {
        request_status: LeaveRequestStatus.APPROVED,
        approved_by: user.userId,
        approved_at: approvedAt,
        approver_comment: dto.comment ?? null,
        balance_snapshot_at_approval: {
          leave_type_name: request.leave_type?.name ?? '',
          available_at_approval: isLwp ? null : availableAfter,
          consumed_by_this_request: totalDays,
        },
        modified_by: user.userId,
      });

      await this.balanceService.writeLedger(
        manager,
        user,
        refreshedBalance,
        LedgerEntryType.REQUEST_CONSUME,
        LedgerDirection.DEBIT,
        totalDays,
        request.id,
        'Leave request approved',
      );

      await this.historyRepo.append(
        {
          leave_request_id: id,
          from_status: LeaveRequestStatus.PENDING,
          to_status: LeaveRequestStatus.APPROVED,
          actor_id: user.userId,
          comment: dto.comment ?? null,
          organization_id: user.organizationId,
          enterprise_id: user.enterpriseId,
          modified_by: user.userId,
        },
        manager,
      );

      this.logger.log(`Leave request ${id} approved by ${user.userId}`);

      return {
        id,
        status: LeaveRequestStatus.APPROVED,
        approved_at: approvedAt,
        approved_by: user.userId,
        balance_after: {
          leave_type_id: balance.leave_type_id,
          available_days: availableAfter,
        },
      };
    });
  }

  async reject(
    user: LoggedInUser,
    id: string,
    dto: RejectRequestDto,
  ): Promise<{
    id: string;
    status: LeaveRequestStatus;
    rejected_at: Date;
    rejected_by: string;
    rejection_reason: string;
  }> {
    return this.dataSource.transaction(async (manager) => {
      const request = await this.requestRepo.lockById(id, manager);
      if (!request || request.organization_id !== user.organizationId) {
        throw new NotFoundException(`REQUEST_NOT_FOUND: ${id}`);
      }
      if (request.request_status !== LeaveRequestStatus.PENDING) {
        throw new UnprocessableEntityException(
          `INVALID_STATE: only PENDING can be rejected (current: ${request.request_status})`,
        );
      }

      await this.releasePending(
        manager,
        user,
        request,
        'Leave request rejected',
      );

      const rejectedAt = new Date();
      await manager.update(LeaveRequest, id, {
        request_status: LeaveRequestStatus.REJECTED,
        rejected_by: user.userId,
        rejected_at: rejectedAt,
        rejection_reason: dto.rejection_reason,
        modified_by: user.userId,
      });

      await this.historyRepo.append(
        {
          leave_request_id: id,
          from_status: LeaveRequestStatus.PENDING,
          to_status: LeaveRequestStatus.REJECTED,
          actor_id: user.userId,
          comment: dto.rejection_reason,
          organization_id: user.organizationId,
          enterprise_id: user.enterpriseId,
          modified_by: user.userId,
        },
        manager,
      );

      this.logger.log(`Leave request ${id} rejected by ${user.userId}`);

      return {
        id,
        status: LeaveRequestStatus.REJECTED,
        rejected_at: rejectedAt,
        rejected_by: user.userId,
        rejection_reason: dto.rejection_reason,
      };
    });
  }

  async adminCancel(
    user: LoggedInUser,
    id: string,
    dto: AdminCancelRequestDto,
  ): Promise<{
    id: string;
    status: LeaveRequestStatus;
    cancelled_at: Date;
    released_days: number;
    cancelled_by_admin: true;
  }> {
    const request = await this.requestRepo.findById(id, user.organizationId);
    if (!request) throw new NotFoundException(`REQUEST_NOT_FOUND: ${id}`);
    const result = await this.cancelInternal(user, request, dto.reason, true);
    return { ...result, cancelled_by_admin: true };
  }

  // ─── Internals ─────────────────────────────────────────────────────────

  private async cancelInternal(
    user: LoggedInUser,
    request: LeaveRequest,
    reason: string | undefined,
    isAdmin: boolean,
  ): Promise<{
    id: string;
    status: LeaveRequestStatus;
    cancelled_at: Date;
    released_days: number;
  }> {
    if (
      request.request_status === LeaveRequestStatus.CANCELLED ||
      request.request_status === LeaveRequestStatus.REJECTED
    ) {
      throw new UnprocessableEntityException(
        `INVALID_STATE: cannot cancel from ${request.request_status}`,
      );
    }

    if (
      !isAdmin &&
      request.request_status === LeaveRequestStatus.APPROVED &&
      this.isPastStartDate(request.from_date)
    ) {
      throw new UnprocessableEntityException(
        'ALREADY_CONSUMED: cannot self-cancel an approved leave whose start date has passed',
      );
    }

    return this.dataSource.transaction(async (manager) => {
      const locked = await this.requestRepo.lockById(request.id, manager);
      if (!locked)
        throw new NotFoundException(`REQUEST_NOT_FOUND: ${request.id}`);

      let releasedDays = 0;

      if (locked.request_status === LeaveRequestStatus.PENDING) {
        releasedDays = Number(locked.total_days);
        await this.releasePending(
          manager,
          user,
          locked,
          'Leave request cancelled',
        );
      } else if (locked.request_status === LeaveRequestStatus.APPROVED) {
        releasedDays = Number(locked.total_days);
        await this.releaseApproved(
          manager,
          user,
          locked,
          'Leave request cancelled',
        );
      }

      const cancelledAt = new Date();
      await manager.update(LeaveRequest, locked.id, {
        request_status: LeaveRequestStatus.CANCELLED,
        cancelled_by: user.userId,
        cancelled_at: cancelledAt,
        cancellation_reason: reason ?? null,
        cancelled_by_admin: isAdmin,
        modified_by: user.userId,
      });

      await this.historyRepo.append(
        {
          leave_request_id: locked.id,
          from_status: locked.request_status,
          to_status: LeaveRequestStatus.CANCELLED,
          actor_id: user.userId,
          comment: reason ?? null,
          organization_id: user.organizationId,
          enterprise_id: user.enterpriseId,
          modified_by: user.userId,
        },
        manager,
      );

      return {
        id: locked.id,
        status: LeaveRequestStatus.CANCELLED,
        cancelled_at: cancelledAt,
        released_days: releasedDays,
      };
    });
  }

  private async holdBalance(
    manager: EntityManager,
    user: LoggedInUser,
    request: LeaveRequest,
    ctx: ValidationContext,
  ): Promise<void> {
    const balance = await this.balanceService.ensureBalanceForRequest(
      user,
      request.employee_id,
      ctx.leaveType,
      ctx.leaveYear,
      manager,
    );

    const newPending = Number(balance.pending_days) + ctx.totalDays;
    await manager.update(LeaveBalance, balance.id, {
      pending_days: newPending.toFixed(2),
      modified_by: user.userId,
    });

    const refreshed = (await manager.findOne(LeaveBalance, {
      where: { id: balance.id },
    }))!;

    await this.balanceService.writeLedger(
      manager,
      user,
      refreshed,
      LedgerEntryType.REQUEST_HOLD,
      LedgerDirection.DEBIT,
      ctx.totalDays,
      request.id,
      'Leave request submitted',
    );
  }

  private async releasePending(
    manager: EntityManager,
    user: LoggedInUser,
    request: LeaveRequest,
    reason: string,
  ): Promise<void> {
    const balance = await this.balanceService.ensureBalanceForRequest(
      user,
      request.employee_id,
      request.leave_type,
      request.leave_year,
      manager,
    );
    const totalDays = Number(request.total_days);
    const newPending = Math.max(0, Number(balance.pending_days) - totalDays);
    await manager.update(LeaveBalance, balance.id, {
      pending_days: newPending.toFixed(2),
      modified_by: user.userId,
    });
    const refreshed = (await manager.findOne(LeaveBalance, {
      where: { id: balance.id },
    }))!;
    await this.balanceService.writeLedger(
      manager,
      user,
      refreshed,
      LedgerEntryType.REQUEST_RELEASE,
      LedgerDirection.CREDIT,
      totalDays,
      request.id,
      reason,
    );
  }

  private async releaseApproved(
    manager: EntityManager,
    user: LoggedInUser,
    request: LeaveRequest,
    reason: string,
  ): Promise<void> {
    const balance = await this.balanceService.ensureBalanceForRequest(
      user,
      request.employee_id,
      request.leave_type,
      request.leave_year,
      manager,
    );
    const totalDays = Number(request.total_days);
    const newUsed = Math.max(0, Number(balance.used_days) - totalDays);
    await manager.update(LeaveBalance, balance.id, {
      used_days: newUsed.toFixed(2),
      modified_by: user.userId,
    });
    const refreshed = (await manager.findOne(LeaveBalance, {
      where: { id: balance.id },
    }))!;
    await this.balanceService.writeLedger(
      manager,
      user,
      refreshed,
      LedgerEntryType.REQUEST_RELEASE,
      LedgerDirection.CREDIT,
      totalDays,
      request.id,
      reason,
    );
  }

  // ─── Validation ─────────────────────────────────────────────────────────

  private async buildContext(
    user: LoggedInUser,
    leaveTypeId: string,
    fromDate: string,
    toDate: string,
    isHalfDay?: boolean,
  ): Promise<ValidationContext> {
    if (new Date(fromDate) > new Date(toDate)) {
      throw new BadRequestException('from_date must be on or before to_date');
    }

    const config = await this.requireActiveConfig(user.organizationId);
    const leaveType = await this.leaveTypeRepo.findOne({
      where: { id: leaveTypeId, config_id: config.id },
    });
    if (!leaveType) {
      throw new NotFoundException(`LEAVE_TYPE_NOT_FOUND: ${leaveTypeId}`);
    }
    const rules = await this.leaveRulesRepo.findOne({
      where: { config_id: config.id },
    });

    const leaveYear = new Date(fromDate).getFullYear();
    const cycleStart = new Date(`${leaveYear}-01-01`);
    const cycleEnd = new Date(`${leaveYear}-12-31`);
    if (new Date(fromDate) < cycleStart || new Date(toDate) > cycleEnd) {
      throw new UnprocessableEntityException(
        'OUT_OF_LEAVE_YEAR: date range must fall within a single leave year',
      );
    }

    const breakdown = this.computeBreakdown(
      fromDate,
      toDate,
      isHalfDay ?? false,
      rules,
    );
    const totalDays = breakdown.billable_days;

    return { leaveType, rules, config, breakdown, totalDays, leaveYear };
  }

  private validateBasicShape(
    dto:
      | CreateLeaveRequestDto
      | (UpdateLeaveRequestDto & { leave_type_id?: string }),
    ctx: ValidationContext,
  ): void {
    const isHalfDay = (dto as CreateLeaveRequestDto).is_half_day ?? false;
    if (isHalfDay) {
      if (
        (dto as CreateLeaveRequestDto).from_date !==
        (dto as CreateLeaveRequestDto).to_date
      ) {
        throw new UnprocessableEntityException(
          'HALF_DAY_RANGE: from_date must equal to_date',
        );
      }
      if (!ctx.leaveType.allow_half_day) {
        throw new UnprocessableEntityException(
          'HALF_DAY_DISABLED: leave type does not allow half-day',
        );
      }
      if (ctx.rules && !ctx.rules.allow_half_day) {
        throw new UnprocessableEntityException(
          'HALF_DAY_DISABLED: organization rules do not allow half-day',
        );
      }
      if (!(dto as CreateLeaveRequestDto).half_day_slot) {
        throw new BadRequestException(
          'half_day_slot is required when is_half_day=true',
        );
      }
    }
  }

  private async validateForSubmit(
    user: LoggedInUser,
    dto: CreateLeaveRequestDto,
    ctx: ValidationContext,
    excludeRequestId: string | undefined,
  ): Promise<void> {
    const isLwp = ctx.leaveType.code === LWP_CODE;

    const overlaps = await this.requestRepo.findOverlapping(
      user.userId,
      user.organizationId,
      dto.from_date,
      dto.to_date,
      excludeRequestId,
    );
    if (overlaps.length > 0) {
      throw new ConflictException(
        'OVERLAPPING_REQUEST: another leave request overlaps this range',
      );
    }

    if (ctx.rules) {
      const today = this.todayStr();
      if (dto.from_date < today) {
        if (!ctx.rules.allow_backdated) {
          throw new UnprocessableEntityException('BACKDATED_NOT_ALLOWED');
        }
        const maxBackdated = ctx.rules.max_backdated_days ?? 0;
        const diffDays = this.dayDiff(dto.from_date, today);
        if (diffDays > maxBackdated) {
          throw new UnprocessableEntityException(
            `BACKDATED_LIMIT_EXCEEDED: ${diffDays} > ${maxBackdated}`,
          );
        }
      }

      if (!isLwp && ctx.rules.max_per_month && ctx.rules.max_per_month > 0) {
        const months = this.monthsCovered(dto.from_date, dto.to_date);
        for (const m of months) {
          const sumExisting = await this.requestRepo.sumDaysInMonth(
            user.userId,
            user.organizationId,
            ctx.leaveType.id,
            m.start,
            m.end,
            excludeRequestId,
          );
          const additionalInThisMonth = this.daysWithinWindow(
            dto.from_date,
            dto.to_date,
            m.start,
            m.end,
            ctx.breakdown.billable_days /
              Math.max(1, this.dayDiff(dto.from_date, dto.to_date) + 1),
          );
          if (sumExisting + additionalInThisMonth > ctx.rules.max_per_month) {
            throw new UnprocessableEntityException(
              `MAX_PER_MONTH_EXCEEDED: ${sumExisting + additionalInThisMonth} > ${ctx.rules.max_per_month}`,
            );
          }
        }
      }
    }

    if (!isLwp) {
      const balance = await this.fetchBalance(
        user,
        user.userId,
        ctx.leaveType,
        ctx.leaveYear,
      );
      const available = balance
        ? (this.balanceService.computeAvailable(balance) ?? 0)
        : ctx.leaveType.days;
      if (available < ctx.totalDays) {
        throw new UnprocessableEntityException(
          `INSUFFICIENT_BALANCE: available=${available}, requested=${ctx.totalDays}`,
        );
      }
    }
  }

  private snapshotRules(rules: LeaveRules | null): LeaveRulesSnapshot | null {
    if (!rules) return null;
    return {
      approval_required: rules.approval_required,
      max_per_month: rules.max_per_month ?? null,
      allow_half_day: rules.allow_half_day,
      allow_backdated: rules.allow_backdated,
      max_backdated_days: rules.max_backdated_days ?? null,
      sandwich_rule: rules.sandwich_rule,
    };
  }

  // ─── Date math (v1: weekend = Sat/Sun; holidays not yet integrated) ────

  private computeBreakdown(
    fromDate: string,
    toDate: string,
    isHalfDay: boolean,
    rules: LeaveRules | null,
  ): DaysBreakdown {
    if (isHalfDay) {
      return {
        calendar_days: 1,
        weekends: 0,
        holidays: 0,
        sandwich_days_added: 0,
        billable_days: 0.5,
      };
    }

    const start = new Date(fromDate);
    const end = new Date(toDate);
    let calendar = 0;
    let weekends = 0;
    const cursor = new Date(start);
    while (cursor <= end) {
      calendar += 1;
      const dow = cursor.getUTCDay();
      if (dow === 0 || dow === 6) weekends += 1;
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    const sandwichOn = !!rules?.sandwich_rule;
    const billable = sandwichOn ? calendar : calendar - weekends;

    return {
      calendar_days: calendar,
      weekends,
      holidays: 0,
      sandwich_days_added: sandwichOn ? weekends : 0,
      billable_days: Math.max(0, Math.round(billable * 100) / 100),
    };
  }

  // ─── Misc helpers ──────────────────────────────────────────────────────

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

  private async fetchBalance(
    user: LoggedInUser,
    employeeId: string,
    leaveType: LeaveType,
    leaveYear: number,
  ): Promise<LeaveBalance | null> {
    return this.dataSource.getRepository(LeaveBalance).findOne({
      where: {
        employee_id: employeeId,
        leave_type_id: leaveType.id,
        leave_year: leaveYear,
        organization_id: user.organizationId,
      },
    });
  }

  private async requireOwn(
    user: LoggedInUser,
    id: string,
  ): Promise<LeaveRequest> {
    const request = await this.requestRepo.findById(id, user.organizationId);
    if (!request) throw new NotFoundException(`REQUEST_NOT_FOUND: ${id}`);
    if (request.employee_id !== user.userId) {
      throw new ForbiddenException('NOT_REQUEST_OWNER');
    }
    return request;
  }

  private isPastStartDate(fromDate: string): boolean {
    return fromDate < this.todayStr();
  }

  private todayStr(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private dayDiff(a: string, b: string): number {
    const ms = new Date(b).getTime() - new Date(a).getTime();
    return Math.floor(ms / (1000 * 60 * 60 * 24));
  }

  private monthsCovered(
    fromDate: string,
    toDate: string,
  ): { start: string; end: string }[] {
    const months: { start: string; end: string }[] = [];
    const start = new Date(fromDate);
    const end = new Date(toDate);
    const cursor = new Date(start.getUTCFullYear(), start.getUTCMonth(), 1);
    while (cursor <= end) {
      const y = cursor.getUTCFullYear();
      const m = cursor.getUTCMonth();
      const firstDay = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
      const lastDay = new Date(Date.UTC(y, m + 1, 0))
        .toISOString()
        .slice(0, 10);
      months.push({ start: firstDay, end: lastDay });
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
    return months;
  }

  private daysWithinWindow(
    requestFrom: string,
    requestTo: string,
    windowFrom: string,
    windowTo: string,
    perDayWeight: number,
  ): number {
    const start = requestFrom > windowFrom ? requestFrom : windowFrom;
    const end = requestTo < windowTo ? requestTo : windowTo;
    if (start > end) return 0;
    const cal = this.dayDiff(start, end) + 1;
    return Math.round(cal * perDayWeight * 100) / 100;
  }

  private errorCodeOf(err: unknown): string {
    if (err instanceof Error) {
      const colon = err.message.indexOf(':');
      if (colon > 0) return err.message.slice(0, colon);
    }
    return 'VALIDATION_ERROR';
  }

  private toListRowMine(r: LeaveRequest): {
    id: string;
    status: LeaveRequestStatus;
    leave_type_name: string;
    from_date: string;
    to_date: string;
    total_days: number;
    is_half_day: boolean;
    reason: string;
    manager_note: string | null;
    submitted_at: Date | null;
    approved_by_name: string | null;
    approved_at: Date | null;
  } {
    return {
      id: r.id,
      status: r.request_status,
      leave_type_name: r.leave_type?.name ?? '',
      from_date: r.from_date,
      to_date: r.to_date,
      total_days: Number(r.total_days),
      is_half_day: r.is_half_day,
      reason: r.reason,
      manager_note: this.resolveManagerNote(r),
      submitted_at: r.submitted_at,
      approved_by_name: null,
      approved_at: r.approved_at,
    };
  }

  private toListRowHr(
    row: import('../repositories/leave-request.repository').RequestListRow,
  ): {
    id: string;
    employee_id: string;
    employee_code: string | null;
    employee_name: string;
    department_name: string | null;
    leave_type_name: string;
    from_date: string;
    to_date: string;
    total_days: number;
    status: LeaveRequestStatus;
    reason: string;
    manager_note: string | null;
    submitted_at: Date | null;
  } {
    const r = row.request;
    const fullName = [
      row.employee_first_name,
      row.employee_middle_name,
      row.employee_last_name,
    ]
      .filter(Boolean)
      .join(' ');
    return {
      id: r.id,
      employee_id: r.employee_id,
      employee_code: row.employee_code,
      employee_name: fullName || 'Unknown',
      department_name: row.department_name,
      leave_type_name: r.leave_type?.name ?? '',
      from_date: r.from_date,
      to_date: r.to_date,
      total_days: Number(r.total_days),
      status: r.request_status,
      reason: r.reason,
      manager_note: this.resolveManagerNote(r),
      submitted_at: r.submitted_at,
    };
  }

  private resolveManagerNote(r: LeaveRequest): string | null {
    switch (r.request_status) {
      case LeaveRequestStatus.APPROVED:
        return r.approver_comment;
      case LeaveRequestStatus.REJECTED:
        return r.rejection_reason;
      case LeaveRequestStatus.CANCELLED:
        return r.cancelled_by_admin ? r.cancellation_reason : null;
      default:
        return null;
    }
  }
}
