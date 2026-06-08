import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { PayrollRunService } from '../services/payroll-run.service';
import { PayrollPreparationService } from '../services/payroll-preparation.service';
import { PayrollProcessingService } from '../services/payroll-processing.service';
import { PayrollAdjustmentService } from '../services/payroll-adjustment.service';
import {
  CreatePayrollRunDto,
  PayrollRunQueryDto,
  RunItemsQueryDto,
  DisburseRunDto,
} from '../dto/payroll-run.dto';
import { CreateAdjustmentDto } from '../dto/payroll-adjustment.dto';
import { JwtAuthGuard } from '../../../core/guards/jwt-auth.guard';
import { AccessGuard } from '../../../core/guards/access.guard';
import { RequirePermission } from '../../../core/guards/require-permission.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { LoggedInUser } from '../../auth/interfaces/logged-in-user.interface';

@UseGuards(JwtAuthGuard, AccessGuard)
@Controller('payroll/runs')
export class PayrollRunController {
  constructor(
    private readonly payrollRunService: PayrollRunService,
    private readonly preparationService: PayrollPreparationService,
    private readonly processingService: PayrollProcessingService,
    private readonly adjustmentService: PayrollAdjustmentService,
  ) {}

  @Post()
  @RequirePermission('PAY_PROCESS', 'create')
  create(@CurrentUser() user: LoggedInUser, @Body() dto: CreatePayrollRunDto) {
    return this.payrollRunService.createRun(user, dto);
  }

  @Get()
  @RequirePermission('PAY_LISTING', 'view')
  list(
    @CurrentUser() user: LoggedInUser,
    @Query() query: PayrollRunQueryDto,
  ) {
    return this.payrollRunService.listRuns(user, query);
  }

  @Get(':id')
  @RequirePermission('PAY_PROCESS', 'view')
  getOne(
    @CurrentUser() user: LoggedInUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.payrollRunService.getRun(user, id);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermission('PAY_PROCESS', 'delete')
  remove(
    @CurrentUser() user: LoggedInUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.payrollRunService.deleteRun(user, id);
  }

  // ─── Preparation & validation ────────────────────────────────────────────────

  @Post(':id/prepare')
  @HttpCode(200)
  @RequirePermission('PAY_PROCESS', 'update')
  prepare(
    @CurrentUser() user: LoggedInUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.preparationService.prepare(user, id);
  }

  @Get(':id/validation')
  @RequirePermission('PAY_PROCESS', 'view')
  validate(
    @CurrentUser() user: LoggedInUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.preparationService.validate(user, id);
  }

  // ─── Items (employee table & detail) ─────────────────────────────────────────

  @Get(':id/items')
  @RequirePermission('PAY_PROCESS', 'view')
  listItems(
    @CurrentUser() user: LoggedInUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: RunItemsQueryDto,
  ) {
    return this.payrollRunService.listItems(user, id, query);
  }

  @Get(':id/items/:itemId')
  @RequirePermission('PAY_PROCESS', 'view')
  getItem(
    @CurrentUser() user: LoggedInUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ) {
    return this.payrollRunService.getItem(user, id, itemId);
  }

  // ─── Processing ──────────────────────────────────────────────────────────────

  @Post(':id/process')
  @HttpCode(200)
  @RequirePermission('PAY_PROCESS', 'update')
  process(
    @CurrentUser() user: LoggedInUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.processingService.process(user, id);
  }

  @Post(':id/items/:itemId/reprocess')
  @HttpCode(200)
  @RequirePermission('PAY_PROCESS', 'update')
  reprocessItem(
    @CurrentUser() user: LoggedInUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ) {
    return this.processingService.reprocessItem(user, id, itemId);
  }

  @Post(':id/lock')
  @HttpCode(200)
  @RequirePermission('PAY_PROCESS', 'approve')
  lock(
    @CurrentUser() user: LoggedInUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.processingService.lock(user, id);
  }

  @Post(':id/disburse')
  @HttpCode(200)
  @RequirePermission('PAY_PROCESS', 'approve')
  disburse(
    @CurrentUser() user: LoggedInUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DisburseRunDto,
  ) {
    return this.processingService.disburse(user, id, dto);
  }

  // ─── Audit trail ─────────────────────────────────────────────────────────────

  @Get(':id/audit')
  @RequirePermission('PAY_PROCESS', 'view')
  auditTrail(
    @CurrentUser() user: LoggedInUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.payrollRunService.getAuditTrail(user, id);
  }

  // ─── Adjustments (bonus / deduction) ─────────────────────────────────────────

  @Post(':id/items/:itemId/adjustments')
  @RequirePermission('PAY_PROCESS', 'update')
  addAdjustment(
    @CurrentUser() user: LoggedInUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: CreateAdjustmentDto,
  ) {
    return this.adjustmentService.addAdjustment(user, id, itemId, dto);
  }

  @Get(':id/items/:itemId/adjustments')
  @RequirePermission('PAY_PROCESS', 'view')
  listAdjustments(
    @CurrentUser() user: LoggedInUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ) {
    return this.adjustmentService.listAdjustments(user, id, itemId);
  }

  @Delete(':id/adjustments/:adjId')
  @HttpCode(204)
  @RequirePermission('PAY_PROCESS', 'update')
  removeAdjustment(
    @CurrentUser() user: LoggedInUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('adjId', ParseUUIDPipe) adjId: string,
  ) {
    return this.adjustmentService.removeAdjustment(user, id, adjId);
  }
}
