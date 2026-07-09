import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminAttendanceService } from '../services/admin-attendance.service';
import { RemoteApprovalService } from '../services/remote-approval.service';
import { AdminDailyPreviewQueryDto } from '../dto/admin-daily-preview-query.dto';
import { EmployeeHistoryQueryDto } from '../dto/employee-history-query.dto';
import { ManualEntryDto } from '../dto/manual-entry.dto';
import { UpdateAttendanceDto } from '../dto/update-attendance.dto';
import { RejectRemoteDto } from '../dto/reject-remote.dto';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AccessGuard } from '../../../core/guards/access.guard';
import { RequirePermission } from '../../../core/guards/require-permission.decorator';
import { LoggedInUser } from '../../../common/decorators/logged-in-user.decorator';
import type { LoggedInUser as LoggedInUserInterface } from '../../auth/interfaces/logged-in-user.interface';
import { AuditLog } from '../../audit/decorators/audit-log.decorator';
import { AuditLogModule } from '../../audit/enums/audit-log-module.enum';
import { AuditAction } from '../../audit/enums/audit-action.enum';

@Controller('attendance/admin')
@UseGuards(JwtAuthGuard, AccessGuard)
export class AdminAttendanceController {
  constructor(
    private readonly adminService: AdminAttendanceService,
    private readonly approvalService: RemoteApprovalService,
  ) {}

  @Get('daily-preview')
  @RequirePermission('ATTENDANCE', 'view')
  dailyPreview(
    @LoggedInUser() user: LoggedInUserInterface,
    @Query() query: AdminDailyPreviewQueryDto,
  ) {
    return this.adminService.dailyPreview(user, query);
  }

  @Get('employees/:employeeId/history')
  @RequirePermission('ATTENDANCE', 'view')
  employeeHistory(
    @LoggedInUser() user: LoggedInUserInterface,
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Query() query: EmployeeHistoryQueryDto,
  ) {
    return this.adminService.getEmployeeHistory(user, employeeId, query);
  }

  @AuditLog(AuditLogModule.ATTENDANCE, AuditAction.CREATE, 'attendance')
  @Post('manual-entry')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('ATTENDANCE', 'create')
  createManual(
    @LoggedInUser() user: LoggedInUserInterface,
    @Body() dto: ManualEntryDto,
  ) {
    return this.adminService.createManual(user, dto);
  }

  @AuditLog(AuditLogModule.ATTENDANCE, AuditAction.UPDATE, 'attendance')
  @Put(':attendanceId')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('ATTENDANCE', 'update')
  update(
    @LoggedInUser() user: LoggedInUserInterface,
    @Param('attendanceId', ParseUUIDPipe) attendanceId: string,
    @Body() dto: UpdateAttendanceDto,
  ) {
    return this.adminService.updateRecord(user, attendanceId, dto);
  }

  @AuditLog(AuditLogModule.ATTENDANCE, AuditAction.DELETE, 'attendance', { entityIdParam: 'attendanceId' })
  @Delete(':attendanceId')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('ATTENDANCE', 'delete')
  remove(
    @LoggedInUser() user: LoggedInUserInterface,
    @Param('attendanceId', ParseUUIDPipe) attendanceId: string,
  ) {
    return this.adminService.deleteRecord(user, attendanceId);
  }

  @Get('remote-approvals')
  @RequirePermission('ATTENDANCE', 'view')
  listPendingApprovals(
    @LoggedInUser() user: LoggedInUserInterface,
    @Query() pagination: PaginationDto,
  ) {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;
    return this.approvalService.listPending(user, page, limit);
  }

  @AuditLog(AuditLogModule.ATTENDANCE, AuditAction.APPROVE, 'attendance', { entityIdParam: 'attendanceId' })
  @Post('remote-approvals/:attendanceId/approve')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('ATTENDANCE', 'approve')
  approveRemote(
    @LoggedInUser() user: LoggedInUserInterface,
    @Param('attendanceId', ParseUUIDPipe) attendanceId: string,
  ) {
    return this.approvalService.approve(user, attendanceId);
  }

  @AuditLog(AuditLogModule.ATTENDANCE, AuditAction.REJECT, 'attendance', { entityIdParam: 'attendanceId' })
  @Post('remote-approvals/:attendanceId/reject')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('ATTENDANCE', 'approve')
  rejectRemote(
    @LoggedInUser() user: LoggedInUserInterface,
    @Param('attendanceId', ParseUUIDPipe) attendanceId: string,
    @Body() dto: RejectRemoteDto,
  ) {
    return this.approvalService.reject(user, attendanceId, dto);
  }
}
