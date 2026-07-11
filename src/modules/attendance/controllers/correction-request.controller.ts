import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CorrectionRequestService } from '../services/correction-request.service';
import {
  CorrectionListQueryDto,
  RejectCorrectionDto,
  SubmitCorrectionDto,
} from '../dto/correction-request.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AccessGuard } from '../../../core/guards/access.guard';
import { RequirePermission } from '../../../core/guards/require-permission.decorator';
import { LoggedInUser } from '../../../common/decorators/logged-in-user.decorator';
import type { LoggedInUser as LoggedInUserInterface } from '../../auth/interfaces/logged-in-user.interface';
import { AuditLog } from '../../audit/decorators/audit-log.decorator';
import { AuditLogModule } from '../../audit/enums/audit-log-module.enum';
import { AuditAction } from '../../audit/enums/audit-action.enum';

/** Employee self-service for auto-checkout corrections. */
@Controller('attendance/me/correction-requests')
@UseGuards(JwtAuthGuard)
export class MyCorrectionRequestController {
  constructor(private readonly service: CorrectionRequestService) {}

  @AuditLog(AuditLogModule.ATTENDANCE, AuditAction.CREATE, 'attendance-correction')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  submit(
    @LoggedInUser() user: LoggedInUserInterface,
    @Body() dto: SubmitCorrectionDto,
  ) {
    return this.service.submit(user, dto);
  }

  @Get()
  listMine(
    @LoggedInUser() user: LoggedInUserInterface,
    @Query() query: CorrectionListQueryDto,
  ) {
    return this.service.listMine(user, query);
  }

  @Get(':id')
  getOne(
    @LoggedInUser() user: LoggedInUserInterface,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.getOne(user, id);
  }
}

/** HR/Admin review of auto-checkout corrections. */
@Controller('attendance/admin/correction-requests')
@UseGuards(JwtAuthGuard, AccessGuard)
export class AdminCorrectionRequestController {
  constructor(private readonly service: CorrectionRequestService) {}

  @Get()
  @RequirePermission('ATTENDANCE', 'view')
  list(
    @LoggedInUser() user: LoggedInUserInterface,
    @Query() query: CorrectionListQueryDto,
  ) {
    return this.service.listAdmin(user, query);
  }

  @Get(':id')
  @RequirePermission('ATTENDANCE', 'view')
  getOne(
    @LoggedInUser() user: LoggedInUserInterface,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.getOne(user, id);
  }

  @AuditLog(AuditLogModule.ATTENDANCE, AuditAction.APPROVE, 'attendance-correction', { entityIdParam: 'id' })
  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('ATTENDANCE', 'approve')
  approve(
    @LoggedInUser() user: LoggedInUserInterface,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.approve(user, id);
  }

  @AuditLog(AuditLogModule.ATTENDANCE, AuditAction.REJECT, 'attendance-correction', { entityIdParam: 'id' })
  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('ATTENDANCE', 'approve')
  reject(
    @LoggedInUser() user: LoggedInUserInterface,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectCorrectionDto,
  ) {
    return this.service.reject(user, id, dto);
  }
}
