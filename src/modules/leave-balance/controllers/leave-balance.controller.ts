import {
  Body,
  Controller,
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
import { LeaveBalanceService } from '../services/leave-balance.service';
import { InitializeBalanceDto } from '../dto/initialize-balance.dto';
import { BulkInitializeDto } from '../dto/bulk-initialize.dto';
import { AdjustBalanceDto } from '../dto/adjust-balance.dto';
import { ListBalanceQueryDto } from '../dto/list-balance-query.dto';
import { LedgerQueryDto } from '../dto/ledger-query.dto';
import { GetMyBalanceQueryDto } from '../dto/get-my-balance-query.dto';

@Controller('leave-balances')
export class LeaveBalanceController {
  constructor(private readonly service: LeaveBalanceService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  getMine(
    @LoggedInUser() user: LoggedInUserInterface,
    @Query() query: GetMyBalanceQueryDto,
  ) {
    return this.service.getMyBalance(user, query.leave_year);
  }

  @Get('employee/:employeeId')
  @UseGuards(JwtAuthGuard, AccessGuard)
  @RequirePermission('LEAVE_MGMT', 'view')
  @HttpCode(HttpStatus.OK)
  getForEmployee(
    @LoggedInUser() user: LoggedInUserInterface,
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Query() query: GetMyBalanceQueryDto,
  ) {
    return this.service.getBalanceForEmployee(
      user,
      employeeId,
      query.leave_year,
    );
  }

  @Post('initialize')
  @UseGuards(JwtAuthGuard, AccessGuard)
  @RequirePermission('LEAVE_MGMT', 'create')
  @HttpCode(HttpStatus.CREATED)
  initialize(
    @LoggedInUser() user: LoggedInUserInterface,
    @Body() dto: InitializeBalanceDto,
  ) {
    return this.service.initializeForEmployee(user, dto);
  }

  @Post('initialize/bulk')
  @UseGuards(JwtAuthGuard, AccessGuard)
  @RequirePermission('LEAVE_MGMT', 'create')
  @HttpCode(HttpStatus.CREATED)
  bulkInitialize(
    @LoggedInUser() user: LoggedInUserInterface,
    @Body() dto: BulkInitializeDto,
  ) {
    return this.service.bulkInitialize(user, dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, AccessGuard)
  @RequirePermission('LEAVE_MGMT', 'view')
  @HttpCode(HttpStatus.OK)
  list(
    @LoggedInUser() user: LoggedInUserInterface,
    @Query() query: ListBalanceQueryDto,
  ) {
    return this.service.listBalances(user, {
      leaveYear: query.leave_year,
      departmentId: query.department_id,
      leaveTypeId: query.leave_type_id,
      employeeId: query.employee_id,
      search: query.search,
      status: query.status,
      lowBalance: query.low_balance,
      page: query.page,
      limit: query.limit,
    });
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, AccessGuard)
  @RequirePermission('LEAVE_MGMT', 'view')
  @HttpCode(HttpStatus.OK)
  getById(
    @LoggedInUser() user: LoggedInUserInterface,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.getBalanceById(user, id);
  }

  @Get(':id/ledger')
  @UseGuards(JwtAuthGuard, AccessGuard)
  @RequirePermission('LEAVE_MGMT', 'view')
  @HttpCode(HttpStatus.OK)
  getLedger(
    @LoggedInUser() user: LoggedInUserInterface,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: LedgerQueryDto,
  ) {
    return this.service.getLedger(user, id, query);
  }

  @Patch(':id/adjust')
  @UseGuards(JwtAuthGuard, AccessGuard)
  @RequirePermission('LEAVE_MGMT', 'update')
  @HttpCode(HttpStatus.OK)
  adjust(
    @LoggedInUser() user: LoggedInUserInterface,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdjustBalanceDto,
  ) {
    return this.service.adjustBalance(user, id, dto);
  }

  @Post(':id/recompute')
  @UseGuards(JwtAuthGuard, AccessGuard)
  @RequirePermission('LEAVE_MGMT', 'update')
  @HttpCode(HttpStatus.OK)
  recompute(
    @LoggedInUser() user: LoggedInUserInterface,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.recompute(user, id);
  }
}
