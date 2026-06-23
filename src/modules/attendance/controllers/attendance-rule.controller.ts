import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Delete,
  Param,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  UseGuards,
  Query,
} from '@nestjs/common';
import { AttendanceRuleService } from '../services/attendance-rule.service';
import { CreateAttendanceRuleDto } from '../dto/create-attendance-rule.dto';
import { UpdateAttendanceRuleDto } from '../dto/update-attendance-rule.dto';
import { ChangeStatusDto } from '../dto/change-status.dto';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AccessGuard } from '../../../core/guards/access.guard';
import { RequirePermission } from '../../../core/guards/require-permission.decorator';
import { LoggedInUser } from '../../../common/decorators/logged-in-user.decorator';
import type { LoggedInUser as LoggedInUserInterface } from '../../auth/interfaces/logged-in-user.interface';
import { AuditLog } from '../../audit/decorators/audit-log.decorator';
import { AuditLogModule } from '../../audit/enums/audit-log-module.enum';
import { AuditAction } from '../../audit/enums/audit-action.enum';

@Controller('attendance/rules')
@UseGuards(JwtAuthGuard, AccessGuard)
export class AttendanceRuleController {
  constructor(private readonly ruleService: AttendanceRuleService) {}

  @AuditLog(AuditLogModule.ATTENDANCE, AuditAction.CREATE, 'attendance_rule')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('ATTENDANCE', 'create')
  create(
    @LoggedInUser() user: LoggedInUserInterface,
    @Body() dto: CreateAttendanceRuleDto,
  ) {
    return this.ruleService.create(user, dto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @RequirePermission('ATTENDANCE', 'view')
  findAll(
    @LoggedInUser() user: LoggedInUserInterface,
    @Query() pagination: PaginationDto,
  ) {
    return this.ruleService.findAll(user, pagination);
  }

  @AuditLog(AuditLogModule.ATTENDANCE, AuditAction.UPDATE, 'attendance_rule')
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('ATTENDANCE', 'update')
  update(
    @LoggedInUser() user: LoggedInUserInterface,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAttendanceRuleDto,
  ) {
    return this.ruleService.update(user, id, dto);
  }

  @AuditLog(AuditLogModule.ATTENDANCE, AuditAction.ACTIVATE, 'attendance_rule')
  @Patch(':id/status')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('ATTENDANCE', 'activate')
  changeStatus(
    @LoggedInUser() user: LoggedInUserInterface,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeStatusDto,
  ) {
    return this.ruleService.changeStatus(user, id, dto);
  }

  @AuditLog(AuditLogModule.ATTENDANCE, AuditAction.DELETE, 'attendance_rule')
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('ATTENDANCE', 'delete')
  delete(
    @LoggedInUser() user: LoggedInUserInterface,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.ruleService.delete(user, id);
  }
}
