import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../core/guards/jwt-auth.guard';
import { AccessGuard } from '../../../core/guards/access.guard';
import { RequirePermission } from '../../../core/guards/require-permission.decorator';
import { LoggedInUser } from '../../../common/decorators/logged-in-user.decorator';
import type { LoggedInUser as LoggedInUserInterface } from '../../auth/interfaces/logged-in-user.interface';
import { AuditService } from '../services/audit.service';
import { AuditLogQueryDto } from '../dto/audit-log-query.dto';

@UseGuards(JwtAuthGuard, AccessGuard)
@Controller('audit-logs')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @RequirePermission('AUDIT_LOG', 'view')
  findAll(
    @LoggedInUser() user: LoggedInUserInterface,
    @Query() query: AuditLogQueryDto,
  ) {
    return this.auditService.findByOrg(user.organizationId, query);
  }

  @Get('filter-options')
  @RequirePermission('AUDIT_LOG', 'view')
  getFilterOptions(@LoggedInUser() user: LoggedInUserInterface) {
    return this.auditService.getFilterOptions(user.organizationId);
  }

  @Get('stats')
  @RequirePermission('AUDIT_LOG', 'view')
  getStats(
    @LoggedInUser() user: LoggedInUserInterface,
    @Query('date_from') dateFrom?: string,
    @Query('date_to') dateTo?: string,
  ) {
    return this.auditService.getStatsByOrg(user.organizationId, dateFrom, dateTo);
  }

  @Get('entity/:entityType/:entityId')
  @RequirePermission('AUDIT_LOG', 'view')
  getEntityHistory(
    @LoggedInUser() user: LoggedInUserInterface,
    @Param('entityType') entityType: string,
    @Param('entityId', ParseUUIDPipe) entityId: string,
  ) {
    return this.auditService.findEntityHistory(user.organizationId, entityType, entityId);
  }
}
