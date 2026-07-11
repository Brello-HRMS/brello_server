import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReimbursementRepository } from '../repositories/reimbursement.repository';
import { AdminReimbursementQueryDto } from '../dto/admin-query.dto';
import { UpdateStatusDto } from '../dto/update-status.dto';
import { ReimbursementStatus } from '../enums/reimbursement.enum';
import { User } from '../../user/entities/user.entity';
import { NotificationService } from '../../notification/services/notification.service';

@Injectable()
export class AdminReimbursementService {
  constructor(
    private readonly reimbursementRepository: ReimbursementRepository,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly notificationService: NotificationService,
  ) {}

  async findAll(
    enterpriseId: string,
    orgId: string,
    query: AdminReimbursementQueryDto,
  ) {
    const [items, total] = await this.reimbursementRepository.findAll(
      enterpriseId,
      orgId,
      query,
    );

    const employeeIds = [...new Set(items.map((r) => r.employee_id))];

    const users = employeeIds.length
      ? await this.userRepo
          .createQueryBuilder('u')
          .leftJoinAndSelect('u.user_profile', 'p')
          .whereInIds(employeeIds)
          .getMany()
      : [];

    const userMap = new Map(users.map((u) => [u.id, u]));

    const enriched = items.map((r) => {
      const user = userMap.get(r.employee_id);
      return {
        ...r,
        employee: user
          ? {
              id: user.id,
              name: `${user.first_name} ${user.last_name}`.trim(),
              employee_code: user.user_profile?.employee_id ?? null,
            }
          : null,
      };
    });

    return {
      items: enriched,
      pagination: {
        page: query.page ?? 1,
        limit: query.limit ?? 20,
        total,
      },
    };
  }

  async updateStatus(id: string, dto: UpdateStatusDto, adminId: string) {
    const reimbursement = await this.reimbursementRepository.findById(id);
    if (!reimbursement) throw new NotFoundException('Reimbursement not found.');

    if (reimbursement.reimb_status !== ReimbursementStatus.PENDING) {
      throw new ConflictException('Only pending reimbursements can be approved or rejected.');
    }

    if (dto.status === ReimbursementStatus.REJECTED && !dto.rejection_reason) {
      throw new BadRequestException('Rejection reason is required when rejecting.');
    }

    const updated = await this.reimbursementRepository.updateStatus(
      reimbursement,
      dto.status,
      dto.rejection_reason,
      adminId,
    );

    const title = dto.status === ReimbursementStatus.APPROVED ? 'Reimbursement Approved' : 'Reimbursement Rejected';
    const body = dto.status === ReimbursementStatus.APPROVED
      ? `Your reimbursement for ${reimbursement.title} has been approved.`
      : `Your reimbursement for ${reimbursement.title} was rejected.`;

    await this.notificationService.broadcastAllChannels({
      user_id: reimbursement.employee_id,
      title,
      message: body,
      event_type: dto.status === ReimbursementStatus.APPROVED ? 'REIMBURSEMENT_APPROVED' : 'REIMBURSEMENT_REJECTED',
    }).catch(err => console.error(err));

    return updated;
  }

  async markPaid(id: string, adminId: string) {
    const reimbursement = await this.reimbursementRepository.findById(id);
    if (!reimbursement) throw new NotFoundException('Reimbursement not found.');

    if (reimbursement.reimb_status !== ReimbursementStatus.APPROVED) {
      throw new ConflictException('Only approved reimbursements can be marked as paid.');
    }

    if (reimbursement.is_paid) {
      throw new ConflictException('Reimbursement is already marked as paid.');
    }

    const updated = await this.reimbursementRepository.markPaid(reimbursement, adminId);

    await this.notificationService.broadcastAllChannels({
      user_id: reimbursement.employee_id,
      title: 'Reimbursement Paid',
      message: `Your reimbursement for ${reimbursement.title} has been marked as paid.`,
      event_type: 'REIMBURSEMENT_PAID',
    }).catch(err => console.error(err));

    return updated;
  }
}
