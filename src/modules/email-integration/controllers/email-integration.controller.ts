import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  Res,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';

import { EmailIntegrationService } from '../services/email-integration.service';
import { TestEmailDto } from '../dto/test-email.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AccessGuard } from '../../../core/guards/access.guard';
import { RequirePermission } from '../../../core/guards/require-permission.decorator';
import { Public } from '../../../common/decorators/public.decorator';
import { LoggedInUser } from '../../../common/decorators/logged-in-user.decorator';
import type { LoggedInUser as LoggedInUserInterface } from '../../auth/interfaces/logged-in-user.interface';

const MODULE = 'INTEGRATION_EMAIL';

@Controller('email-integrations')
@UseGuards(JwtAuthGuard, AccessGuard)
export class EmailIntegrationController {
  constructor(
    private readonly emailIntegrationService: EmailIntegrationService,
  ) {}

  /** List the organization's connected email accounts. */
  @Get()
  @RequirePermission(MODULE, 'view')
  @HttpCode(HttpStatus.OK)
  list(@LoggedInUser() user: LoggedInUserInterface) {
    return this.emailIntegrationService.list(user);
  }

  /** Returns the Google consent URL the frontend opens to start the connect. */
  @Get('google/auth-url')
  @RequirePermission(MODULE, 'create')
  @HttpCode(HttpStatus.OK)
  getGoogleAuthUrl(@LoggedInUser() user: LoggedInUserInterface) {
    return this.emailIntegrationService.getGoogleAuthUrl(user);
  }

  /**
   * Google OAuth redirect target. PUBLIC — the browser arrives here from Google
   * with no auth header; org/user context comes from the signed `state`.
   * Always 302-redirects back to the webapp with a success/error query param.
   */
  @Public()
  @Get('google/callback')
  async googleCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const redirectUrl = await this.emailIntegrationService.handleGoogleCallback(
      code,
      state,
      error,
    );
    res.redirect(redirectUrl);
  }

  /** Make this account the organization's active outbound sender. */
  @Patch(':id/activate')
  @RequirePermission(MODULE, 'activate')
  @HttpCode(HttpStatus.OK)
  activate(
    @Param('id', ParseUUIDPipe) id: string,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.emailIntegrationService.activate(id, user);
  }

  /** Turn off this account without disconnecting it. */
  @Patch(':id/deactivate')
  @RequirePermission(MODULE, 'activate')
  @HttpCode(HttpStatus.OK)
  deactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.emailIntegrationService.deactivate(id, user);
  }

  /** Send a test email through this account. */
  @Post(':id/test')
  @RequirePermission(MODULE, 'view')
  @HttpCode(HttpStatus.OK)
  sendTest(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TestEmailDto,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.emailIntegrationService.sendTest(id, dto, user);
  }

  /** Disconnect the account (revokes at Google + soft-deletes locally). */
  @Delete(':id')
  @RequirePermission(MODULE, 'delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  disconnect(
    @Param('id', ParseUUIDPipe) id: string,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.emailIntegrationService.disconnect(id, user);
  }
}
