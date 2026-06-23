import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { FeedbackTicketRepository } from '../repositories/feedback-ticket.repository';
import { FeedbackCommentRepository } from '../repositories/feedback-comment.repository';
import { CreateFeedbackTicketDto } from '../dto/create-feedback-ticket.dto';
import { AddCommentDto } from '../dto/add-comment.dto';
import { OrgQueryFeedbackDto } from '../dto/org-query-feedback.dto';
import { FeedbackStatus } from '../enums/feedback-status.enum';
import { FeedbackPriority } from '../enums/feedback-priority.enum';
import { FeedbackType } from '../enums/feedback-type.enum';
import { FEEDBACK_CATEGORIES, ISSUE_CATEGORIES } from '../enums/feedback-category.enum';
import { NotificationService } from '../../notification/services/notification.service';
import { NotificationType } from '../../../common/enums/notification-type.enum';

// Platform admin user ID to notify — resolved via env/config in production
const PLATFORM_ADMIN_NOTIFICATION_USER_ID = process.env.PLATFORM_ADMIN_USER_ID ?? null;

@Injectable()
export class FeedbackService {
  constructor(
    private readonly ticketRepo: FeedbackTicketRepository,
    private readonly commentRepo: FeedbackCommentRepository,
    private readonly notificationService: NotificationService,
  ) {}

  async create(
    userId: string,
    enterpriseId: string,
    organizationId: string,
    dto: CreateFeedbackTicketDto,
  ) {
    this.validateTypeCategory(dto.type, dto.category);

    const ticket = await this.ticketRepo.create({
      submitted_by: userId,
      enterprise_id: enterpriseId,
      organization_id: organizationId,
      type: dto.type,
      category: dto.category,
      title: dto.title,
      ticket_description: dto.ticket_description,
      affected_module: dto.affected_module ?? null,
      attachments: dto.attachments ?? null,
      ticket_status: FeedbackStatus.SUBMITTED,
      priority: FeedbackPriority.MEDIUM,
      created_by: userId,
    });

    this.notifyPlatformAdmin(
      `New ${dto.type === FeedbackType.FEEDBACK ? 'Feedback' : 'Issue Report'} submitted`,
      `"${dto.title}" submitted by an org user.`,
      { ticket_id: ticket.id },
    );

    return ticket;
  }

  async findAll(
    organizationId: string,
    enterpriseId: string,
    query: OrgQueryFeedbackDto,
  ) {
    const [items, total] = await this.ticketRepo.findByOrg(organizationId, enterpriseId, query);
    return {
      items,
      pagination: { page: query.page ?? 1, limit: query.limit ?? 20, total },
    };
  }

  async findOne(id: string, organizationId: string) {
    const ticket = await this.ticketRepo.findByIdAndOrg(id, organizationId);
    if (!ticket) throw new NotFoundException('Feedback ticket not found.');

    const comments = await this.commentRepo.findByTicket(id, false);
    return { ...ticket, comments };
  }

  async addComment(
    ticketId: string,
    userId: string,
    organizationId: string,
    dto: AddCommentDto,
  ) {
    const ticket = await this.ticketRepo.findByIdAndOrg(ticketId, organizationId);
    if (!ticket) throw new NotFoundException('Feedback ticket not found.');

    const comment = await this.commentRepo.create({
      ticket_id: ticketId,
      author_id: userId,
      body: dto.body,
      is_internal: false,
    });

    this.notifyPlatformAdmin(
      'New follow-up comment',
      `A follow-up was added to ticket "${ticket.title}".`,
      { ticket_id: ticketId },
    );

    return comment;
  }

  private validateTypeCategory(type: FeedbackType, category: any) {
    if (type === FeedbackType.FEEDBACK && !FEEDBACK_CATEGORIES.includes(category)) {
      throw new BadRequestException(
        `Category "${category}" is not valid for type FEEDBACK. Use FEATURE_REQUEST, SUGGESTION, or PRAISE.`,
      );
    }
    if (type === FeedbackType.ISSUE_REPORT && !ISSUE_CATEGORIES.includes(category)) {
      throw new BadRequestException(
        `Category "${category}" is not valid for type ISSUE_REPORT. Use BUG, UI_UX, PERFORMANCE, or DATA_ISSUE.`,
      );
    }
  }

  private notifyPlatformAdmin(title: string, message: string, metadata: Record<string, any>) {
    if (!PLATFORM_ADMIN_NOTIFICATION_USER_ID) return;
    this.notificationService
      .send({
        user_id: PLATFORM_ADMIN_NOTIFICATION_USER_ID,
        title,
        message,
        type: NotificationType.IN_APP,
        metadata,
      })
      .catch(() => {
        // fire-and-forget — notification failure must not block the response
      });
  }
}
