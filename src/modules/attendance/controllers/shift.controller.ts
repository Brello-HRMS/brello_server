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
import { ShiftService } from '../services/shift.service';
import { CreateShiftDto } from '../dto/create-shift.dto';
import { UpdateShiftDto } from '../dto/update-shift.dto';
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

@Controller('attendance/shifts')
@UseGuards(JwtAuthGuard, AccessGuard)
export class ShiftController {
  constructor(private readonly shiftService: ShiftService) {}

  @AuditLog(AuditLogModule.SHIFT, AuditAction.CREATE, 'shift')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('ATTENDANCE', 'create')
  create(
    @LoggedInUser() user: LoggedInUserInterface,
    @Body() dto: CreateShiftDto,
  ) {
    return this.shiftService.create(user, dto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @RequirePermission('ATTENDANCE', 'view')
  findAll(
    @LoggedInUser() user: LoggedInUserInterface,
    @Query() pagination: PaginationDto,
  ) {
    return this.shiftService.findAll(user, pagination);
  }

  @AuditLog(AuditLogModule.SHIFT, AuditAction.UPDATE, 'shift')
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('ATTENDANCE', 'update')
  update(
    @LoggedInUser() user: LoggedInUserInterface,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateShiftDto,
  ) {
    return this.shiftService.update(user, id, dto);
  }

  @AuditLog(AuditLogModule.SHIFT, AuditAction.ACTIVATE, 'shift')
  @Patch(':id/status')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('ATTENDANCE', 'activate')
  changeStatus(
    @LoggedInUser() user: LoggedInUserInterface,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeStatusDto,
  ) {
    return this.shiftService.changeStatus(user, id, dto);
  }

  @AuditLog(AuditLogModule.SHIFT, AuditAction.DELETE, 'shift')
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('ATTENDANCE', 'delete')
  delete(
    @LoggedInUser() user: LoggedInUserInterface,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.shiftService.delete(user, id);
  }
}
