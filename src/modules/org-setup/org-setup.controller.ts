import { AccessGuard } from '../../core/guards/access.guard';
import { RequirePermission } from '../../core/guards/require-permission.decorator';
import { Controller, Get, UseGuards } from '@nestjs/common';
import { OrgSetupService } from './org-setup.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { LoggedInUser } from '../../common/decorators/logged-in-user.decorator';
import type { LoggedInUser as LoggedInUserInterface } from '../auth/interfaces/logged-in-user.interface';

@Controller('organization')
@UseGuards(JwtAuthGuard, AccessGuard)
export class OrgSetupController {
  constructor(private readonly orgSetupService: OrgSetupService) {}

  @Get('setup-status')
  @RequirePermission('ORG_SETUP', 'view')
  async getSetupStatus(@LoggedInUser() user: LoggedInUserInterface) {
    if (!user || !user.organizationId) {
      return null;
    }
    return this.orgSetupService.getSetupStatus(user.organizationId);
  }
}
