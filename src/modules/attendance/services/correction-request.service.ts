import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { LoggedInUser } from '../../auth/interfaces/logged-in-user.interface';
import { AttendanceSession } from '../entities/attendance-session.entity';
import { AttendanceCorrectionRequest } from '../entities/attendance-correction-request.entity';
import { AttendanceCorrectionRequestRepository } from '../repositories/attendance-correction-request.repository';
import { AttendanceRecordRepository } from '../repositories/attendance-record.repository';
import { ShiftRepository } from '../repositories/shift.repository';
import { AttendanceRuleRepository } from '../repositories/attendance-rule.repository';
import { AttendanceAuditLogRepository } from '../repositories/attendance-audit-log.repository';
import { AttendanceService } from './attendance.service';
import { AuditEventType } from '../enums/audit-event-type.enum';
import { CorrectionStatus } from '../enums/correction-status.enum';
import {
  CorrectionListQueryDto,
  RejectCorrectionDto,
  SubmitCorrectionDto,
} from '../dto/correction-request.dto';

/**
 * Employee disputes an auto-checkout (claims the real checkout time); HR approves
 * (recompute with the requested time) or rejects (keep auto values). See
 * auto-checkout.md §8.
 */
@Injectable()
export class CorrectionRequestService {
  constructor(
    @InjectRepository(AttendanceSession)
    private readonly sessionRepo: Repository<AttendanceSession>,
    private readonly correctionRepo: AttendanceCorrectionRequestRepository,
    private readonly recordRepo: AttendanceRecordRepository,
    private readonly shiftRepo: ShiftRepository,
    private readonly ruleRepo: AttendanceRuleRepository,
    private readonly auditRepo: AttendanceAuditLogRepository,
    private readonly attendanceService: AttendanceService,
  ) {}

  async submit(user: LoggedInUser, dto: SubmitCorrectionDto) {
    const session = await this.sessionRepo.findOne({
      where: {
        id: dto.attendance_session_id,
        organization_id: user.organizationId,
      },
    });
    if (!session) throw new NotFoundException('Attendance session not found.');
    if (session.employee_id !== user.userId) {
      throw new BadRequestException('You can only correct your own attendance.');
    }
    if (!session.is_auto_checkout) {
      throw new BadRequestException(
        'Only auto-closed sessions can be corrected.',
      );
    }

    const requested = new Date(dto.requested_check_out_at);
    if (requested < session.check_in_at) {
      throw new BadRequestException(
        'Requested checkout time cannot be before check-in.',
      );
    }
    // Fail-safe: an auto-checkout session must have a checkout time. If it is
    // somehow null, refuse rather than skip the upper-bound check (which would
    // let the employee claim an unbounded future time).
    if (!session.check_out_at) {
      throw new BadRequestException(
        'Auto-checkout session has no checkout time; cannot process a correction.',
      );
    }
    if (requested > session.check_out_at) {
      throw new BadRequestException(
        'Requested checkout time cannot be later than the auto-checkout time.',
      );
    }

    const existing = await this.correctionRepo.findPendingBySession(session.id);
    if (existing) {
      throw new ConflictException(
        'A correction request for this session is already pending.',
      );
    }

    const record = await this.recordRepo.findById(
      session.attendance_record_id,
      user.organizationId,
    );
    if (!record) throw new NotFoundException('Attendance record not found.');

    const request = await this.correctionRepo.create({
      enterprise_id: user.enterpriseId,
      organization_id: user.organizationId,
      attendance_record_id: record.id,
      attendance_session_id: session.id,
      employee_id: user.userId,
      requested_check_out_at: requested,
      employee_reason: dto.employee_reason,
      auto_checkout_at: session.check_out_at ?? requested,
      auto_worked_minutes: record.worked_minutes,
      approval_status: CorrectionStatus.PENDING,
      modified_by: user.userId,
    });

    await this.recordRepo.update(record.id, {
      correction_status: CorrectionStatus.PENDING,
      modified_by: user.userId,
    });

    await this.auditRepo.create({
      enterprise_id: user.enterpriseId,
      organization_id: user.organizationId,
      attendance_record_id: record.id,
      attendance_session_id: session.id,
      employee_id: user.userId,
      performed_by: user.userId,
      event_type: AuditEventType.CORRECTION_SUBMITTED,
      new_value: {
        requested_check_out_at: requested.toISOString(),
        employee_reason: dto.employee_reason,
      },
    });

    return request;
  }

  async approve(user: LoggedInUser, id: string) {
    const request = await this.requirePending(user, id);

    const session = await this.sessionRepo.findOne({
      where: {
        id: request.attendance_session_id,
        organization_id: user.organizationId,
      },
    });
    const record = await this.recordRepo.findById(
      request.attendance_record_id,
      user.organizationId,
    );
    if (!session || !record) {
      throw new NotFoundException('Attendance session or record not found.');
    }
    if (!record.shift_id || !record.rule_id) {
      throw new BadRequestException(
        'Attendance record is missing shift/rule; cannot recompute.',
      );
    }
    const shift = await this.shiftRepo.findOneByOrg(
      record.shift_id,
      user.organizationId,
    );
    const rule = await this.ruleRepo.findOneByOrg(
      record.rule_id,
      user.organizationId,
    );
    if (!shift || !rule) {
      throw new BadRequestException(
        'Shift or rule no longer exists; cannot recompute.',
      );
    }

    const computed = await this.attendanceService.applyCheckout({
      session,
      record,
      rule,
      shift,
      checkOutAt: request.requested_check_out_at,
      performedBy: user.userId,
    });

    await this.recordRepo.update(record.id, {
      correction_status: CorrectionStatus.APPROVED,
      modified_by: user.userId,
    });
    await this.correctionRepo.update(request.id, {
      approval_status: CorrectionStatus.APPROVED,
      reviewed_by: user.userId,
      reviewed_at: new Date(),
      modified_by: user.userId,
    });

    await this.auditRepo.create({
      enterprise_id: user.enterpriseId,
      organization_id: user.organizationId,
      attendance_record_id: record.id,
      attendance_session_id: session.id,
      employee_id: request.employee_id,
      performed_by: user.userId,
      event_type: AuditEventType.CORRECTION_APPROVED,
      new_value: {
        check_out_at: request.requested_check_out_at,
        worked_minutes: computed.worked_minutes,
        attendance_status: computed.attendance_status,
      },
    });

    return { id: request.id, approval_status: CorrectionStatus.APPROVED, computed };
  }

  async reject(user: LoggedInUser, id: string, dto: RejectCorrectionDto) {
    const request = await this.requirePending(user, id);

    await this.correctionRepo.update(request.id, {
      approval_status: CorrectionStatus.REJECTED,
      reviewer_notes: dto.reviewer_notes ?? null,
      reviewed_by: user.userId,
      reviewed_at: new Date(),
      modified_by: user.userId,
    });
    await this.recordRepo.update(request.attendance_record_id, {
      correction_status: CorrectionStatus.REJECTED,
      modified_by: user.userId,
    });

    await this.auditRepo.create({
      enterprise_id: user.enterpriseId,
      organization_id: user.organizationId,
      attendance_record_id: request.attendance_record_id,
      attendance_session_id: request.attendance_session_id,
      employee_id: request.employee_id,
      performed_by: user.userId,
      event_type: AuditEventType.CORRECTION_REJECTED,
      new_value: { reviewer_notes: dto.reviewer_notes ?? null },
    });

    return { id: request.id, approval_status: CorrectionStatus.REJECTED };
  }

  listMine(user: LoggedInUser, query: CorrectionListQueryDto) {
    return this.correctionRepo.list(user.organizationId, query, user.userId);
  }

  listAdmin(user: LoggedInUser, query: CorrectionListQueryDto) {
    return this.correctionRepo.list(user.organizationId, query);
  }

  async getOne(user: LoggedInUser, id: string) {
    const request = await this.correctionRepo.findById(id, user.organizationId);
    if (!request) throw new NotFoundException('Correction request not found.');
    return request;
  }

  private async requirePending(
    user: LoggedInUser,
    id: string,
  ): Promise<AttendanceCorrectionRequest> {
    const request = await this.correctionRepo.findById(id, user.organizationId);
    if (!request) throw new NotFoundException('Correction request not found.');
    if (request.approval_status !== CorrectionStatus.PENDING) {
      throw new BadRequestException(
        `Correction request is already ${request.approval_status}.`,
      );
    }
    return request;
  }
}
