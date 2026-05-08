import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AccessGuard } from '../../../core/guards/access.guard';
import { RequirePermission } from '../../../core/guards/require-permission.decorator';
import { LoggedInUser } from '../../../common/decorators/logged-in-user.decorator';
import type { LoggedInUser as LoggedInUserInterface } from '../../auth/interfaces/logged-in-user.interface';
import { LeaveRequestService } from '../services/leave-request.service';
import { CreateLeaveRequestDto } from '../dto/create-leave-request.dto';
import { UpdateLeaveRequestDto } from '../dto/update-leave-request.dto';
import { ApproveRequestDto } from '../dto/approve-request.dto';
import { RejectRequestDto } from '../dto/reject-request.dto';
import { CancelRequestDto } from '../dto/cancel-request.dto';
import { AdminCancelRequestDto } from '../dto/admin-cancel-request.dto';
import { ListLeaveRequestQueryDto } from '../dto/list-leave-request-query.dto';

@Controller('leave-requests')
export class LeaveRequestController {
  constructor(private readonly service: LeaveRequestService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  create(
    @LoggedInUser() user: LoggedInUserInterface,
    @Body() dto: CreateLeaveRequestDto,
  ) {
    return this.service.create(user, dto);
  }

  @Post('validate')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  validate(
    @LoggedInUser() user: LoggedInUserInterface,
    @Body() dto: CreateLeaveRequestDto,
  ) {
    return this.service.validate(user, dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  listMine(
    @LoggedInUser() user: LoggedInUserInterface,
    @Query() query: ListLeaveRequestQueryDto,
  ) {
    return this.service.listMine(user, query);
  }

  @Get('pending-approval')
  @UseGuards(JwtAuthGuard, AccessGuard)
  @RequirePermission('LEAVE_MGMT', 'approve')
  @HttpCode(HttpStatus.OK)
  pendingApproval(
    @LoggedInUser() user: LoggedInUserInterface,
    @Query() query: ListLeaveRequestQueryDto,
  ) {
    return this.service.pendingApprovals(user, query);
  }

  @Get()
  @UseGuards(JwtAuthGuard, AccessGuard)
  @RequirePermission('LEAVE_MGMT', 'view')
  @HttpCode(HttpStatus.OK)
  list(
    @LoggedInUser() user: LoggedInUserInterface,
    @Query() query: ListLeaveRequestQueryDto,
  ) {
    return this.service.listAll(user, query);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  getOne(
    @LoggedInUser() user: LoggedInUserInterface,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.getById(user, id);
  }

  @Get(':id/history')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  history(
    @LoggedInUser() user: LoggedInUserInterface,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.getHistory(user, id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  update(
    @LoggedInUser() user: LoggedInUserInterface,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLeaveRequestDto,
  ) {
    return this.service.updateMine(user, id, dto);
  }

  @Post(':id/submit')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  submit(
    @LoggedInUser() user: LoggedInUserInterface,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.submitDraft(user, id);
  }

  @Post(':id/cancel')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  cancel(
    @LoggedInUser() user: LoggedInUserInterface,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelRequestDto,
  ) {
    return this.service.cancelMine(user, id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(
    @LoggedInUser() user: LoggedInUserInterface,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.deleteDraft(user, id);
  }

  @Post(':id/approve')
  @UseGuards(JwtAuthGuard, AccessGuard)
  @RequirePermission('LEAVE_MGMT', 'approve')
  @HttpCode(HttpStatus.OK)
  approve(
    @LoggedInUser() user: LoggedInUserInterface,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApproveRequestDto,
  ) {
    return this.service.approve(user, id, dto);
  }

  @Post(':id/reject')
  @UseGuards(JwtAuthGuard, AccessGuard)
  @RequirePermission('LEAVE_MGMT', 'approve')
  @HttpCode(HttpStatus.OK)
  reject(
    @LoggedInUser() user: LoggedInUserInterface,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectRequestDto,
  ) {
    return this.service.reject(user, id, dto);
  }

  @Post(':id/admin-cancel')
  @UseGuards(JwtAuthGuard, AccessGuard)
  @RequirePermission('LEAVE_MGMT', 'delete')
  @HttpCode(HttpStatus.OK)
  adminCancel(
    @LoggedInUser() user: LoggedInUserInterface,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminCancelRequestDto,
  ) {
    return this.service.adminCancel(user, id, dto);
  }
}
