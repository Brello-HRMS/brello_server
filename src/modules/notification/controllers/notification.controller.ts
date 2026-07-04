import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { LoggedInUser } from '../../../common/decorators/logged-in-user.decorator';
import type { LoggedInUser as LoggedInUserInterface } from '../../auth/interfaces/logged-in-user.interface';
import { InAppNotificationService } from '../services/in-app-notification.service';
import { NotificationType } from '../../../common/enums/notification-type.enum';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationController {
  constructor(
    private readonly inAppNotificationService: InAppNotificationService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get all active in-app notifications for the current user' })
  @ApiResponse({ status: 200, description: 'List of in-app notifications' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getAll(@LoggedInUser() user: LoggedInUserInterface) {
    return this.inAppNotificationService.getAll(user);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread in-app notification count for the current user' })
  @ApiResponse({ status: 200, description: 'Unread notification count', schema: { example: { count: 3 } } })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getUnreadCount(@LoggedInUser() user: LoggedInUserInterface) {
    const count = await this.inAppNotificationService.getUnreadCount(user);
    return { count };
  }

  @Get('unread')
  @ApiOperation({ summary: 'Get unread in-app notifications for the current user' })
  @ApiResponse({ status: 200, description: 'List of unread in-app notifications' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getUnread(@LoggedInUser() user: LoggedInUserInterface) {
    return this.inAppNotificationService.getUnread(user);
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  @ApiResponse({ status: 200, description: 'All notifications marked as read', schema: { example: { success: true } } })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async markAllAsRead(@LoggedInUser() user: LoggedInUserInterface) {
    await this.inAppNotificationService.markAllAsRead(user);
    return { success: true };
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a specific notification as read' })
  @ApiResponse({ status: 200, description: 'Notification marked as read', schema: { example: { success: true } } })
  @ApiResponse({ status: 400, description: 'Invalid UUID' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async markAsRead(
    @Param('id', ParseUUIDPipe) id: string,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    await this.inAppNotificationService.markAsRead(id, user);
    return { success: true };
  }

  // TODO: remove before production
  @Post('test')
  @ApiOperation({ summary: '[DEV] Create a test notification for the current user' })
  @ApiResponse({ status: 201, description: 'Test notification created' })
  async createTestNotification(@LoggedInUser() user: LoggedInUserInterface) {
    return this.inAppNotificationService.send({
      user_id: user.userId,
      title: 'Test notification',
      message: 'This is a test in-app notification created via POST /notifications/test.',
      type: NotificationType.IN_APP,
      metadata: { event_type: 'leave.approved' },
    });
  }
}
