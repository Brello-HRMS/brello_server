import {
  Controller,
  Get,
  Patch,
  Param,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
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
  async getAll(@CurrentUser() user: JwtPayload) {
    return this.inAppNotificationService.getAll(user.userId);
  }

  @Get('unread')
  @ApiOperation({
    summary: 'Get unread in-app notifications for the current user',
  })
  async getUnread(@CurrentUser() user: JwtPayload) {
    return this.inAppNotificationService.getUnread(user.userId);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a specific notification as read' })
  async markAsRead(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.inAppNotificationService.markAsRead(id, user.userId);
    return { success: true };
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  async markAllAsRead(@CurrentUser() user: JwtPayload) {
    await this.inAppNotificationService.markAllAsRead(user.userId);
    return { success: true };
  }
}
