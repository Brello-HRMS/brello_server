import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AnnouncementRepository } from '../repositories/announcement.repository';
import { EmployeeAnnouncementQueryDto } from '../dto/employee-query.dto';
import { AnnouncementStatus } from '../enums/announcement.enum';
import { User } from '../../user/entities/user.entity';

@Injectable()
export class EmployeeAnnouncementService {
  constructor(
    private readonly announcementRepository: AnnouncementRepository,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async findForEmployee(
    employeeId: string,
    enterpriseId: string,
    orgId: string,
    query: EmployeeAnnouncementQueryDto,
  ) {
    const user = await this.userRepo.findOne({ where: { id: employeeId } });
    const departmentId = user?.department_id ?? null;

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const [announcements, total] = await this.announcementRepository.findPublishedForEmployee(
      enterpriseId,
      orgId,
      employeeId,
      departmentId,
      page,
      limit,
    );

    const ids = announcements.map((a) => a.id);
    const readSet = await this.announcementRepository.getReadStatusForEmployee(ids, employeeId);

    const items = announcements.map((a) => ({
      id: a.id,
      title: a.title,
      description_html: a.description_html,
      priority: a.priority,
      published_at: a.published_at,
      attachments: a.attachments,
      is_read: readSet.has(a.id),
    }));

    return {
      items,
      pagination: { page, limit, total },
    };
  }

  async markRead(announcementId: string, employeeId: string) {
    const announcement = await this.announcementRepository.findById(announcementId);
    if (!announcement) throw new NotFoundException('Announcement not found');
    if (announcement.ann_status !== AnnouncementStatus.PUBLISHED) {
      throw new NotFoundException('Announcement not found');
    }

    await this.announcementRepository.upsertRead(announcementId, employeeId);
    return { success: true };
  }
}
