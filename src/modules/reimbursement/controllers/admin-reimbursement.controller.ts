import { AccessGuard } from '../../../core/guards/access.guard';
import { RequirePermission } from '../../../core/guards/require-permission.decorator';
import {
  Controller,
  Get,
  Patch,
  Body,
  Param,
  Query,
  HttpCode,
  UseGuards,
} from '@nestjs/common';
import { AdminReimbursementService } from '../services/admin-reimbursement.service';
import { AdminReimbursementQueryDto } from '../dto/admin-query.dto';
import { UpdateStatusDto } from '../dto/update-status.dto';
import { JwtAuthGuard } from '../../../core/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AuditLog } from '../../audit/decorators/audit-log.decorator';
import { AuditLogModule } from '../../audit/enums/audit-log-module.enum';
import { AuditAction } from '../../audit/enums/audit-action.enum';

interface AuthPayload {
  userId: string;
  enterpriseId: string;
  organizationId: string;
}

@UseGuards(JwtAuthGuard, AccessGuard)
@Controller('admin/reimbursements')
export class AdminReimbursementController {
  constructor(private readonly adminReimbursementService: AdminReimbursementService) {}

  @Get()
  @RequirePermission('REIMBURSEMENT', 'view')
  async findAll(
    @CurrentUser() user: AuthPayload,
    @Query() query: AdminReimbursementQueryDto,
  ) {
    return this.adminReimbursementService.findAll(
      user.enterpriseId,
      user.organizationId,
      query,
    );
  }

  @AuditLog(AuditLogModule.REIMBURSEMENT, AuditAction.APPROVE, 'reimbursement')
  @Patch(':id/status')
  @RequirePermission('REIMBURSEMENT', 'update')
  @HttpCode(200)
  async updateStatus(
    @CurrentUser() user: AuthPayload,
    @Param('id') id: string,
    @Body() dto: UpdateStatusDto,
  ) {
    return this.adminReimbursementService.updateStatus(id, dto, user.userId);
  }

  @AuditLog(AuditLogModule.REIMBURSEMENT, AuditAction.PAY, 'reimbursement')
  @Patch(':id/mark-paid')
  @RequirePermission('REIMBURSEMENT', 'update')
  @HttpCode(200)
  async markPaid(@CurrentUser() user: AuthPayload, @Param('id') id: string) {
    return this.adminReimbursementService.markPaid(id, user.userId);
  }
}
