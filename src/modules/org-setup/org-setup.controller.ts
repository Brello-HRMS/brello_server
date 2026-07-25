import { AccessGuard } from '../../core/guards/access.guard';
import { Controller, Get, UseGuards } from '@nestjs/common';
import { OrgSetupService } from './org-setup.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { LoggedInUser } from '../../common/decorators/logged-in-user.decorator';
import type { LoggedInUser as LoggedInUserInterface } from '../auth/interfaces/logged-in-user.interface';

@Controller('organization')
@UseGuards(JwtAuthGuard, AccessGuard)
export class OrgSetupController {
  constructor(private readonly orgSetupService: OrgSetupService) {}

  // No @RequirePermission: this is the caller's own onboarding progress and must
  // be reachable by a brand-new admin who hasn't been granted ORG_PROFILE:view yet.
  // The handler self-scopes to the user's org and null-guards the no-org case.
  @Get('setup-status')
  async getSetupStatus(@LoggedInUser() user: LoggedInUserInterface) {
    if (!user || !user.organizationId) {
      return null;
    }
    return this.orgSetupService.getSetupStatus(user.organizationId);
  }
}
