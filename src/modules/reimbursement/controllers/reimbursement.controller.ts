import { AccessGuard } from '../../../core/guards/access.guard';
import { RestrictedOnExpiry } from '../../billing/decorators/restricted-on-expiry.decorator';
import { RequirePermission } from '../../../core/guards/require-permission.decorator';
import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  UseGuards,
} from '@nestjs/common';
import { ReimbursementService } from '../services/reimbursement.service';
import { CreateReimbursementDto } from '../dto/create-reimbursement.dto';
import { UpdateReimbursementDto } from '../dto/update-reimbursement.dto';
import { EmployeeReimbursementQueryDto } from '../dto/employee-query.dto';
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
@Controller('reimbursements')
@RestrictedOnExpiry()
export class ReimbursementController {
  constructor(private readonly reimbursementService: ReimbursementService) {}

  @AuditLog(AuditLogModule.REIMBURSEMENT, AuditAction.CREATE, 'reimbursement')
  @Post()
  @RequirePermission('REIMBURSEMENT', 'create')
  async create(
    @CurrentUser() user: AuthPayload,
    @Body() dto: CreateReimbursementDto,
  ) {
    return this.reimbursementService.create(
      user.userId,
      user.enterpriseId,
      user.organizationId,
      dto,
    );
  }

  @Get('me')
  @RequirePermission('REIMBURSEMENT', 'view')
  async findMine(
    @CurrentUser() user: AuthPayload,
    @Query() query: EmployeeReimbursementQueryDto,
  ) {
    return this.reimbursementService.findMine(
      user.userId,
      user.enterpriseId,
      user.organizationId,
      query,
    );
  }

  @AuditLog(AuditLogModule.REIMBURSEMENT, AuditAction.UPDATE, 'reimbursement')
  @Put(':id')
  @RequirePermission('REIMBURSEMENT', 'update')
  async update(
    @CurrentUser() user: AuthPayload,
    @Param('id') id: string,
    @Body() dto: UpdateReimbursementDto,
  ) {
    return this.reimbursementService.update(user.userId, id, dto);
  }

  @AuditLog(AuditLogModule.REIMBURSEMENT, AuditAction.DELETE, 'reimbursement')
  @Delete(':id')
  @RequirePermission('REIMBURSEMENT', 'delete')
  @HttpCode(200)
  async remove(@CurrentUser() user: AuthPayload, @Param('id') id: string) {
    return this.reimbursementService.remove(user.userId, id);
  }
}
