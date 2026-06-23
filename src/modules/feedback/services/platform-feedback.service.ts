import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import { Organization } from '../../organization/entities/organization.entity';
import { FeedbackTicketRepository } from '../repositories/feedback-ticket.repository';
import { FeedbackCommentRepository } from '../repositories/feedback-comment.repository';
import { FeedbackStatusLogRepository } from '../repositories/feedback-status-log.repository';
import { UpdateTicketDto } from '../dto/update-ticket.dto';
import { PlatformAddCommentDto } from '../dto/platform-add-comment.dto';
import { PlatformQueryFeedbackDto } from '../dto/platform-query-feedback.dto';
import { VALID_TRANSITIONS } from '../enums/feedback-status.enum';
import { NotificationService } from '../../notification/services/notification.service';
import { NotificationType } from '../../../common/enums/notification-type.enum';

@Injectable()
export class PlatformFeedbackService {
  constructor(
    private readonly ticketRepo: FeedbackTicketRepository,
    private readonly commentRepo: FeedbackCommentRepository,
    private readonly statusLogRepo: FeedbackStatusLogRepository,
    private readonly notificationService: NotificationService,
    private readonly dataSource: DataSource,
  ) {}

  async findAll(query: PlatformQueryFeedbackDto) {
    const [items, total] = await this.ticketRepo.findAll(query);

    const orgIds = [...new Set(items.map((t) => t.organization_id).filter(Boolean))];
    let orgNameMap: Record<string, string> = {};
    if (orgIds.length > 0) {
      const orgs = await this.dataSource.getRepository(Organization).find({
        select: ['id', 'name'],
        where: { id: In(orgIds) },
      });
      orgNameMap = Object.fromEntries(orgs.map((o) => [o.id, o.name]));
    }

    return {
      items: items.map((t) => ({ ...t, organization_name: orgNameMap[t.organization_id] ?? null })),
      pagination: { page: query.page ?? 1, limit: query.limit ?? 20, total },
    };
  }

  async findOne(id: string) {
    const ticket = await this.ticketRepo.findById(id);
    if (!ticket) throw new NotFoundException('Feedback ticket not found.');

    const [comments, statusHistory] = await Promise.all([
      this.commentRepo.findByTicket(id, true),
      this.statusLogRepo.findByTicket(id),
    ]);

    return { ...ticket, comments, status_history: statusHistory };
  }

  async update(id: string, adminId: string, dto: UpdateTicketDto) {
    const ticket = await this.ticketRepo.findById(id);
    if (!ticket) throw new NotFoundException('Feedback ticket not found.');

    if (dto.status) {
      const allowed = VALID_TRANSITIONS[ticket.ticket_status];
      if (!allowed.includes(dto.status)) {
        throw new BadRequestException(
          `Cannot transition from "${ticket.ticket_status}" to "${dto.status}".`,
        );
      }
    }

    await this.dataSource.transaction(async () => {
      if (dto.status) {
        const oldStatus = ticket.ticket_status;
        await this.ticketRepo.updateStatus(ticket, dto.status, adminId);
        await this.statusLogRepo.log(id, adminId, oldStatus, dto.status, dto.note ?? undefined);
      }
      if (dto.priority) {
        await this.ticketRepo.updatePriority(ticket, dto.priority, adminId);
      }
    });

    if (dto.status) {
      this.notifySubmitter(
        ticket.submitted_by,
        'Your ticket status has been updated',
        `Your ticket "${ticket.title}" is now ${dto.status}.`,
        { ticket_id: id, new_status: dto.status },
      );
    }

    return ticket;
  }

  async addComment(id: string, adminId: string, dto: PlatformAddCommentDto) {
    const ticket = await this.ticketRepo.findById(id);
    if (!ticket) throw new NotFoundException('Feedback ticket not found.');

    const comment = await this.commentRepo.create({
      ticket_id: id,
      author_id: adminId,
      body: dto.body,
      is_internal: dto.is_internal ?? false,
    });

    if (!dto.is_internal) {
      this.notifySubmitter(
        ticket.submitted_by,
        'New reply on your ticket',
        `The Brello team replied to "${ticket.title}".`,
        { ticket_id: id },
      );
    }

    return comment;
  }

  async getStats() {
    return this.ticketRepo.getStats();
  }

  private notifySubmitter(
    userId: string,
    title: string,
    message: string,
    metadata: Record<string, any>,
  ) {
    this.notificationService
      .send({
        user_id: userId,
        title,
        message,
        type: NotificationType.IN_APP,
        metadata,
      })
      .catch(() => {
        // fire-and-forget
      });
  }
}
