import {
  Controller,
  Get,
  Patch,
  Param,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { LoggedInUser } from '../../../common/decorators/logged-in-user.decorator';
import type { LoggedInUser as LoggedInUserInterface } from '../../auth/interfaces/logged-in-user.interface';
import { InAppNotificationService } from '../services/in-app-notification.service';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationController {
  constructor(
    private readonly inAppNotificationService: InAppNotificationService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Get all active in-app notifications for the current user',
  })
  async getAll(@LoggedInUser() user: LoggedInUserInterface) {
    return this.inAppNotificationService.getAll(user);
  }

  @Get('unread')
  @ApiOperation({
    summary: 'Get unread in-app notifications for the current user',
  })
  async getUnread(@LoggedInUser() user: LoggedInUserInterface) {
    return this.inAppNotificationService.getUnread(user);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a specific notification as read' })
  async markAsRead(
    @Param('id', ParseUUIDPipe) id: string,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    await this.inAppNotificationService.markAsRead(id, user);
    return { success: true };
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  async markAllAsRead(@LoggedInUser() user: LoggedInUserInterface) {
    await this.inAppNotificationService.markAllAsRead(user);
    return { success: true };
  }
}
