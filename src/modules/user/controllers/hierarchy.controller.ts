import {
  Controller,
  Get,
  Param,
  Query,
  ParseUUIDPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AccessGuard } from '../../../core/guards/access.guard';
import { RequirePermission } from '../../../core/guards/require-permission.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { LoggedInUser } from '../../../common/decorators/logged-in-user.decorator';
import type { LoggedInUser as LoggedInUserInterface } from '../../auth/interfaces/logged-in-user.interface';
import { HierarchyService } from '../services/hierarchy.service';
import { ReporteesQueryDto } from '../dto/reportees-query.dto';

/**
 * HierarchyController — Company structure / user reporting hierarchy.
 *
 * Org-wide endpoints are gated by the COMPANY_STRUCTURE module (Admin app).
 * `GET /hierarchy/me` returns only the caller's own data, so it needs
 * authentication but no module permission — the same pattern as GET /menu.
 */
@Controller('hierarchy')
@UseGuards(JwtAuthGuard, AccessGuard)
export class HierarchyController {
  constructor(private readonly hierarchyService: HierarchyService) {}

  // Full company-wide org tree (roots → nested reportees)
  @Get('tree')
  @RequirePermission('COMPANY_STRUCTURE', 'view')
  @HttpCode(HttpStatus.OK)
  getTree(@LoggedInUser() user: LoggedInUserInterface) {
    return this.hierarchyService.getOrgTree(user);
  }

  // The logged-in user's own hierarchy (manager chain + reportee subtree)
  @Get('me')
  @HttpCode(HttpStatus.OK)
  getMyHierarchy(@LoggedInUser() user: LoggedInUserInterface) {
    return this.hierarchyService.getMyHierarchy(user);
  }

  // Reportees of a user — direct by default, ?recursive=true for the subtree
  @Get('reportees/:id')
  @RequirePermission('COMPANY_STRUCTURE', 'view')
  @HttpCode(HttpStatus.OK)
  getReportees(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ReporteesQueryDto,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.hierarchyService.getReportees(
      id,
      user,
      query.recursive === 'true',
    );
  }

  // Manager chain above a user (direct manager first → top last)
  @Get('managers/:id')
  @RequirePermission('COMPANY_STRUCTURE', 'view')
  @HttpCode(HttpStatus.OK)
  getManagers(
    @Param('id', ParseUUIDPipe) id: string,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.hierarchyService.getManagerChain(id, user);
  }
}
