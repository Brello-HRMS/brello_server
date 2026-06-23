import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { FeedbackComment } from '../entities/feedback-comment.entity';

@Injectable()
export class FeedbackCommentRepository {
  constructor(
    @InjectRepository(FeedbackComment)
    private readonly repo: Repository<FeedbackComment>,
  ) {}

  async create(data: Partial<FeedbackComment>): Promise<FeedbackComment> {
    const comment = this.repo.create(data);
    return this.repo.save(comment);
  }

  async findByTicket(ticketId: string, includeInternal: boolean): Promise<FeedbackComment[]> {
    const qb = this.repo
      .createQueryBuilder('c')
      .where('c.ticket_id = :ticketId', { ticketId })
      .andWhere('c.deleted_at IS NULL');

    if (!includeInternal) {
      qb.andWhere('c.is_internal = false');
    }

    qb.orderBy('c.created_at', 'ASC');
    return qb.getMany();
  }
}
