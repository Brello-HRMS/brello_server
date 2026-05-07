import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { LeaveRequestHistory } from '../entities/leave-request-history.entity';

@Injectable()
export class LeaveRequestHistoryRepository {
  constructor(
    @InjectRepository(LeaveRequestHistory)
    private readonly repo: Repository<LeaveRequestHistory>,
  ) {}

  async append(
    data: Partial<LeaveRequestHistory>,
    manager?: EntityManager,
  ): Promise<LeaveRequestHistory> {
    if (manager) {
      return manager.save(manager.create(LeaveRequestHistory, data));
    }
    return this.repo.save(this.repo.create(data));
  }

  async findByRequest(leaveRequestId: string): Promise<LeaveRequestHistory[]> {
    return this.repo.find({
      where: { leave_request_id: leaveRequestId },
      order: { created_at: 'ASC' },
    });
  }
}
