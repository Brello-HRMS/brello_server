import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../core/guards/jwt-auth.guard';
import { PlatformAdminGuard } from '../../../core/guards/platform-admin.guard';
import { AuditService } from '../services/audit.service';
import { PlatformAuditLogQueryDto } from '../dto/audit-log-query.dto';

@UseGuards(JwtAuthGuard, PlatformAdminGuard)
@Controller('platform/audit-logs')
export class PlatformAuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  findAll(@Query() query: PlatformAuditLogQueryDto) {
    return this.auditService.findByPlatform(query);
  }

  @Get('filter-options')
  getFilterOptions(@Query('organization_id') organizationId?: string) {
    return this.auditService.getFilterOptions(organizationId);
  }

  @Get('stats')
  getStats(
    @Query('organization_id') organizationId?: string,
    @Query('date_from') dateFrom?: string,
    @Query('date_to') dateTo?: string,
  ) {
    if (organizationId) {
      return this.auditService.getStatsByOrg(organizationId, dateFrom, dateTo);
    }
    return this.auditService.getPlatformStats(dateFrom, dateTo);
  }

  @Get('entity/:entityType/:entityId')
  getEntityHistory(
    @Query('organization_id') organizationId: string,
    @Param('entityType') entityType: string,
    @Param('entityId', ParseUUIDPipe) entityId: string,
  ) {
    return this.auditService.findEntityHistory(organizationId ?? '', entityType, entityId);
  }
}
