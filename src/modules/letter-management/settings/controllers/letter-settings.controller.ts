import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { LetterSettingsService } from '../services/letter-settings.service';
import { UpdateLetterSettingsDto } from '../dto/letter-settings.dto';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { AccessGuard } from '../../../../core/guards/access.guard';
import { RequirePermission } from '../../../../core/guards/require-permission.decorator';
import { LoggedInUser } from '../../../../common/decorators/logged-in-user.decorator';
import type { LoggedInUser as LoggedInUserInterface } from '../../../auth/interfaces/logged-in-user.interface';

@Controller('letter-management/settings')
@UseGuards(JwtAuthGuard, AccessGuard)
export class LetterSettingsController {
  constructor(private readonly settingsService: LetterSettingsService) {}

  @Get()
  @RequirePermission('LETTER_TEMPLATES', 'view')
  get(@LoggedInUser() user: LoggedInUserInterface) {
    return this.settingsService.get(user);
  }

  @Patch()
  @RequirePermission('LETTER_TEMPLATES', 'edit')
  update(@LoggedInUser() user: LoggedInUserInterface, @Body() dto: UpdateLetterSettingsDto) {
    return this.settingsService.update(user, dto);
  }
}
