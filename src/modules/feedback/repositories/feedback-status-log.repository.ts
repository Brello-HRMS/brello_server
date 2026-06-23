import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FeedbackStatusLog } from '../entities/feedback-status-log.entity';
import { FeedbackStatus } from '../enums/feedback-status.enum';

@Injectable()
export class FeedbackStatusLogRepository {
  constructor(
    @InjectRepository(FeedbackStatusLog)
    private readonly repo: Repository<FeedbackStatusLog>,
  ) {}

  async log(
    ticketId: string,
    changedBy: string,
    oldStatus: FeedbackStatus,
    newStatus: FeedbackStatus,
    note?: string,
  ): Promise<void> {
    const entry = this.repo.create({
      ticket_id: ticketId,
      changed_by: changedBy,
      old_status: oldStatus,
      new_status: newStatus,
      note: note ?? null,
    });
    await this.repo.save(entry);
  }

  async findByTicket(ticketId: string): Promise<FeedbackStatusLog[]> {
    return this.repo.find({
      where: { ticket_id: ticketId },
      order: { created_at: 'ASC' },
    });
  }
}
