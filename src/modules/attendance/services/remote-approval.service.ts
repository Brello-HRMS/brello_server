import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { LoggedInUser } from '../../auth/interfaces/logged-in-user.interface';
import { RejectRemoteDto } from '../dto/reject-remote.dto';
import { AttendanceAuditLogRepository } from '../repositories/attendance-audit-log.repository';
import { AttendanceRecordRepository } from '../repositories/attendance-record.repository';
import { AttendanceSessionRepository } from '../repositories/attendance-session.repository';
import { RemoteApprovalRepository } from '../repositories/remote-approval.repository';
import { AttendanceRuleResolverService } from './attendance-rule-resolver.service';
import { ApprovalStatus } from '../enums/approval-status.enum';
import { AttendanceStatus } from '../enums/attendance-status.enum';
import { AuditEventType } from '../enums/audit-event-type.enum';
import {
  computeAttendanceStatus,
  formatTime12,
  isCheckInLate,
} from './attendance-calc.util';

@Injectable()
export class RemoteApprovalService {
  private readonly logger = new Logger(RemoteApprovalService.name);

  constructor(
    private readonly approvalRepo: RemoteApprovalRepository,
    private readonly recordRepo: AttendanceRecordRepository,
    private readonly sessionRepo: AttendanceSessionRepository,
    private readonly auditRepo: AttendanceAuditLogRepository,
    private readonly ruleResolver: AttendanceRuleResolverService,
  ) {}

  async listPending(user: LoggedInUser, page: number, limit: number) {
    const { rows, total } = await this.approvalRepo.listPending(
      user.organizationId,
      page,
      limit,
    );

    return {
      items: rows.map(({ approval, ...meta }) => ({
        attendance_id: approval.attendance_record_id,
        employee: {
          employee_id: approval.employee_id,
          name: [meta.first_name, meta.middle_name, meta.last_name]
            .filter(Boolean)
            .join(' '),
          emp_code: meta.emp_code,
        },
        date: meta.date,
        check_in_time: formatTime12(meta.first_check_in_at),
        remote_reason: approval.remote_reason,
        distance_from_office_meters: approval.distance_from_office_meters,
        approval_status: approval.approval_status,
      })),
      pagination: { page, limit, total },
    };
  }

  async approve(user: LoggedInUser, attendanceId: string) {
    const approval = await this.approvalRepo.findByRecord(
      attendanceId,
      user.organizationId,
    );
    if (!approval) {
      throw new NotFoundException('Pending remote approval not found');
    }
    if (approval.approval_status !== ApprovalStatus.PENDING) {
      throw new ConflictException(
        `Approval already ${approval.approval_status.toLowerCase()}`,
      );
    }

    const record = await this.recordRepo.findById(
      attendanceId,
      user.organizationId,
    );
    if (!record) {
      throw new NotFoundException('Attendance record not found');
    }

    const { rule, shift } = await this.ruleResolver.resolveForEmployee(
      user.organizationId,
      record.employee_id,
    );

    const isLate = record.first_check_in_at
      ? isCheckInLate(record.first_check_in_at, shift).isLate
      : false;

    const computed = computeAttendanceStatus(
      record.worked_minutes,
      rule,
      isLate,
    );

    await this.approvalRepo.update(approval.id, {
      approval_status: ApprovalStatus.APPROVED,
      reviewed_by: user.userId,
      reviewed_at: new Date(),
      modified_by: user.userId,
    });

    await this.recordRepo.update(record.id, {
      attendance_status: computed.attendance_status,
      modified_by: user.userId,
    });

    await this.auditRepo.create({
      attendance_record_id: record.id,
      employee_id: record.employee_id,
      performed_by: user.userId,
      event_type: AuditEventType.REMOTE_APPROVE,
      organization_id: user.organizationId,
      enterprise_id: user.enterpriseId,
      modified_by: user.userId,
      new_value: { attendance_status: computed.attendance_status },
    });

    return {
      attendance_status: computed.attendance_status,
      approval_status: ApprovalStatus.APPROVED,
    };
  }

  async reject(user: LoggedInUser, attendanceId: string, dto: RejectRemoteDto) {
    const approval = await this.approvalRepo.findByRecord(
      attendanceId,
      user.organizationId,
    );
    if (!approval) {
      throw new NotFoundException('Pending remote approval not found');
    }
    if (approval.approval_status !== ApprovalStatus.PENDING) {
      throw new ConflictException(
        `Approval already ${approval.approval_status.toLowerCase()}`,
      );
    }

    const record = await this.recordRepo.findById(
      attendanceId,
      user.organizationId,
    );
    if (!record) {
      throw new NotFoundException('Attendance record not found');
    }

    await this.approvalRepo.update(approval.id, {
      approval_status: ApprovalStatus.REJECTED,
      reviewed_by: user.userId,
      reviewed_at: new Date(),
      reject_reason: dto.reason,
      modified_by: user.userId,
    });

    await this.recordRepo.update(record.id, {
      attendance_status: AttendanceStatus.ABSENT,
      modified_by: user.userId,
    });

    await this.auditRepo.create({
      attendance_record_id: record.id,
      employee_id: record.employee_id,
      performed_by: user.userId,
      event_type: AuditEventType.REMOTE_REJECT,
      organization_id: user.organizationId,
      enterprise_id: user.enterpriseId,
      modified_by: user.userId,
      old_value: { attendance_status: record.attendance_status },
      new_value: {
        attendance_status: AttendanceStatus.ABSENT,
        reason: dto.reason,
      },
    });

    return {
      attendance_status: AttendanceStatus.ABSENT,
      approval_status: ApprovalStatus.REJECTED,
    };
  }
}
