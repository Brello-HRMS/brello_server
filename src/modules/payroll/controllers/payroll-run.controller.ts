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
import { AuditLog } from '../../audit/decorators/audit-log.decorator';
import { AuditLogModule } from '../../audit/enums/audit-log-module.enum';
import { AuditAction } from '../../audit/enums/audit-action.enum';

@UseGuards(JwtAuthGuard, AccessGuard)
@Controller('payroll/runs')
export class PayrollRunController {
  constructor(
    private readonly payrollRunService: PayrollRunService,
    private readonly preparationService: PayrollPreparationService,
    private readonly processingService: PayrollProcessingService,
    private readonly adjustmentService: PayrollAdjustmentService,
  ) {}

  @AuditLog(AuditLogModule.PAYROLL, AuditAction.CREATE, 'payroll_run')
  @Post()
  @RequirePermission('PAYROLL_OVERVIEW', 'create')
  create(@CurrentUser() user: LoggedInUser, @Body() dto: CreatePayrollRunDto) {
    return this.payrollRunService.createRun(user, dto);
  }

  @Get()
  @RequirePermission('PAYROLL_OVERVIEW', 'view')
  list(
    @CurrentUser() user: LoggedInUser,
    @Query() query: PayrollRunQueryDto,
  ) {
    return this.payrollRunService.listRuns(user, query);
  }

  @Get(':id')
  @RequirePermission('PAYROLL_OVERVIEW', 'view')
  getOne(
    @CurrentUser() user: LoggedInUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.payrollRunService.getRun(user, id);
  }

  @AuditLog(AuditLogModule.PAYROLL, AuditAction.DELETE, 'payroll_run')
  @Delete(':id')
  @HttpCode(204)
  @RequirePermission('PAYROLL_OVERVIEW', 'delete')
  remove(
    @CurrentUser() user: LoggedInUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.payrollRunService.deleteRun(user, id);
  }

  // ─── Preparation & validation ────────────────────────────────────────────────

  @AuditLog(AuditLogModule.PAYROLL, AuditAction.UPDATE, 'payroll_run')
  @Post(':id/prepare')
  @HttpCode(200)
  @RequirePermission('PAYROLL_OVERVIEW', 'update')
  prepare(
    @CurrentUser() user: LoggedInUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.preparationService.prepare(user, id);
  }

  @Get(':id/validation')
  @RequirePermission('PAYROLL_OVERVIEW', 'view')
  validate(
    @CurrentUser() user: LoggedInUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.preparationService.validate(user, id);
  }

  // ─── Items (employee table & detail) ─────────────────────────────────────────

  @Get(':id/items')
  @RequirePermission('PAYROLL_OVERVIEW', 'view')
  listItems(
    @CurrentUser() user: LoggedInUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: RunItemsQueryDto,
  ) {
    return this.payrollRunService.listItems(user, id, query);
  }

  @Get(':id/items/:itemId')
  @RequirePermission('PAYROLL_OVERVIEW', 'view')
  getItem(
    @CurrentUser() user: LoggedInUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ) {
    return this.payrollRunService.getItem(user, id, itemId);
  }

  // ─── Processing ──────────────────────────────────────────────────────────────

  @AuditLog(AuditLogModule.PAYROLL, AuditAction.PROCESS, 'payroll_run')
  @Post(':id/process')
  @HttpCode(200)
  @RequirePermission('PAYROLL_OVERVIEW', 'update')
  process(
    @CurrentUser() user: LoggedInUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.processingService.process(user, id);
  }

  @AuditLog(AuditLogModule.PAYROLL, AuditAction.UPDATE, 'payroll_run_item')
  @Post(':id/items/:itemId/reprocess')
  @HttpCode(200)
  @RequirePermission('PAYROLL_OVERVIEW', 'update')
  reprocessItem(
    @CurrentUser() user: LoggedInUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ) {
    return this.processingService.reprocessItem(user, id, itemId);
  }

  @AuditLog(AuditLogModule.PAYROLL, AuditAction.LOCK, 'payroll_run')
  @Post(':id/lock')
  @HttpCode(200)
  @RequirePermission('PAYROLL_OVERVIEW', 'approve')
  lock(
    @CurrentUser() user: LoggedInUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.processingService.lock(user, id);
  }

  @AuditLog(AuditLogModule.PAYROLL, AuditAction.DISBURSE, 'payroll_run')
  @Post(':id/disburse')
  @HttpCode(200)
  @RequirePermission('PAYROLL_OVERVIEW', 'approve')
  disburse(
    @CurrentUser() user: LoggedInUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DisburseRunDto,
  ) {
    return this.processingService.disburse(user, id, dto);
  }



  // ─── Adjustments (bonus / deduction) ─────────────────────────────────────────

  @AuditLog(AuditLogModule.PAYROLL, AuditAction.ADJUST, 'payroll_run_item')
  @Post(':id/items/:itemId/adjustments')
  @RequirePermission('PAYROLL_OVERVIEW', 'update')
  addAdjustment(
    @CurrentUser() user: LoggedInUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: CreateAdjustmentDto,
  ) {
    return this.adjustmentService.addAdjustment(user, id, itemId, dto);
  }

  @Get(':id/items/:itemId/adjustments')
  @RequirePermission('PAYROLL_OVERVIEW', 'view')
  listAdjustments(
    @CurrentUser() user: LoggedInUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ) {
    return this.adjustmentService.listAdjustments(user, id, itemId);
  }

  @AuditLog(AuditLogModule.PAYROLL, AuditAction.DELETE, 'payroll_adjustment', { entityIdParam: 'adjId' })
  @Delete(':id/adjustments/:adjId')
  @HttpCode(204)
  @RequirePermission('PAYROLL_OVERVIEW', 'update')
  removeAdjustment(
    @CurrentUser() user: LoggedInUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('adjId', ParseUUIDPipe) adjId: string,
  ) {
    return this.adjustmentService.removeAdjustment(user, id, adjId);
  }
}
