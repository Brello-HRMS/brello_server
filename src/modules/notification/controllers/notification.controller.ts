import { AccessGuard } from '../../../core/guards/access.guard';
import { RequirePermission } from '../../../core/guards/require-permission.decorator';
import {
  Body,
  Controller,
  Delete,
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
import { NotificationPreferenceRepository } from '../repositories/notification-preference.repository';
import { PushNotificationService } from '../services/push-notification.service';
import { PushSubscriptionRepository } from '../repositories/push-subscription.repository';
import { NotificationType } from '../../../common/enums/notification-type.enum';
import { UpdatePreferenceDto } from '../dto/update-preference.dto';
import { SubscribePushDto, UnsubscribePushDto } from '../dto/subscribe-push.dto';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AccessGuard)
@Controller('notifications')
export class NotificationController {
  constructor(
    private readonly inAppNotificationService: InAppNotificationService,
    private readonly preferenceRepository: NotificationPreferenceRepository,
    private readonly pushNotificationService: PushNotificationService,
    private readonly pushSubRepository: PushSubscriptionRepository,
  ) {}

  @Get()
  @RequirePermission('NOTIFICATION', 'view')
  @ApiOperation({ summary: 'Get all active in-app notifications for the current user' })
  @ApiResponse({ status: 200, description: 'List of in-app notifications' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getAll(@LoggedInUser() user: LoggedInUserInterface) {
    return this.inAppNotificationService.getAll(user);
  }

  @Get('unread-count')
  @RequirePermission('NOTIFICATION', 'view')
  @ApiOperation({ summary: 'Get unread in-app notification count for the current user' })
  @ApiResponse({ status: 200, description: 'Unread notification count', schema: { example: { count: 3 } } })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getUnreadCount(@LoggedInUser() user: LoggedInUserInterface) {
    const count = await this.inAppNotificationService.getUnreadCount(user);
    return { count };
  }

  @Get('unread')
  @RequirePermission('NOTIFICATION', 'view')
  @ApiOperation({ summary: 'Get unread in-app notifications for the current user' })
  @ApiResponse({ status: 200, description: 'List of unread in-app notifications' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getUnread(@LoggedInUser() user: LoggedInUserInterface) {
    return this.inAppNotificationService.getUnread(user);
  }

  @Patch('read-all')
  @RequirePermission('NOTIFICATION', 'update')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  @ApiResponse({ status: 200, description: 'All notifications marked as read', schema: { example: { success: true } } })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async markAllAsRead(@LoggedInUser() user: LoggedInUserInterface) {
    await this.inAppNotificationService.markAllAsRead(user);
    return { success: true };
  }

  @Patch(':id/read')
  @RequirePermission('NOTIFICATION', 'update')
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

  @Get('preferences')
  @RequirePermission('NOTIFICATION', 'view')
  @ApiOperation({ summary: 'Get all notification preferences for the current user' })
  @ApiResponse({ status: 200, description: 'List of saved notification preferences' })
  async getPreferences(@LoggedInUser() user: LoggedInUserInterface) {
    return this.preferenceRepository.findAll(user.userId);
  }

  @Patch('preferences')
  @RequirePermission('NOTIFICATION', 'update')
  @ApiOperation({ summary: 'Create or update a notification preference' })
  @ApiResponse({ status: 200, description: 'Preference saved' })
  async updatePreference(
    @LoggedInUser() user: LoggedInUserInterface,
    @Body() dto: UpdatePreferenceDto,
  ) {
    return this.preferenceRepository.upsert(user.userId, dto.channel, dto.event_type, dto.enabled);
  }

  @Get('vapid-public-key')
  @RequirePermission('NOTIFICATION', 'view')
  @ApiOperation({ summary: 'Get the VAPID public key for web push subscription' })
  @ApiResponse({ status: 200, description: 'VAPID public key', schema: { example: { publicKey: 'BCtYb8RU...' } } })
  getVapidPublicKey() {
    return { publicKey: this.pushNotificationService.getVapidPublicKey() ?? null };
  }

  @Post('push-subscription')
  @RequirePermission('NOTIFICATION', 'create')
  @ApiOperation({ summary: 'Register a browser push subscription for the current user' })
  @ApiResponse({ status: 201, description: 'Subscription registered' })
  async subscribePush(
    @LoggedInUser() user: LoggedInUserInterface,
    @Body() dto: SubscribePushDto,
  ) {
    const sub = await this.pushSubRepository.upsert(
      user.userId,
      dto.endpoint,
      dto.p256dh,
      dto.auth,
      dto.platform ?? 'web',
    );
    return { id: sub.id };
  }

  @Delete('push-subscription')
  @RequirePermission('NOTIFICATION', 'delete')
  @ApiOperation({ summary: 'Remove a browser push subscription for the current user' })
  @ApiResponse({ status: 200, description: 'Subscription removed', schema: { example: { success: true } } })
  async unsubscribePush(
    @LoggedInUser() user: LoggedInUserInterface,
    @Body() dto: UnsubscribePushDto,
  ) {
    await this.pushSubRepository.deleteByUserAndEndpoint(user.userId, dto.endpoint);
    return { success: true };
  }

  // TODO: remove before production
  @Post('test')
  @RequirePermission('NOTIFICATION', 'create')
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
