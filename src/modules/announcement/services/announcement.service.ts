import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AnnouncementRepository } from '../repositories/announcement.repository';
import { CreateAnnouncementDto } from '../dto/create-announcement.dto';
import { UpdateAnnouncementDto } from '../dto/update-announcement.dto';
import { AdminAnnouncementQueryDto } from '../dto/admin-query.dto';
import {
  AnnouncementStatus,
  AnnouncementPublishType,
} from '../enums/announcement.enum';
import { User } from '../../user/entities/user.entity';
import { SearchIndexingService } from '../../global-search/services/search-indexing.service';
import { AuditContextService } from '../../audit/services/audit-context.service';

const EDITABLE_STATUSES: AnnouncementStatus[] = [
  AnnouncementStatus.DRAFT,
  AnnouncementStatus.SCHEDULED,
];

@Injectable()
export class AnnouncementService {
  constructor(
    private readonly announcementRepository: AnnouncementRepository,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly searchIndexingService: SearchIndexingService,
    private readonly auditContext: AuditContextService,
  ) {}

  async create(
    enterpriseId: string,
    orgId: string,
    userId: string,
    dto: CreateAnnouncementDto,
  ) {
    if (dto.publish_type === AnnouncementPublishType.SCHEDULED) {
      if (!dto.scheduled_at) {
        throw new BadRequestException('scheduled_at is required when publish_type is SCHEDULED');
      }
      if (new Date(dto.scheduled_at) <= new Date()) {
        throw new BadRequestException('scheduled_at must be a future date');
      }
    }

    const status =
      dto.publish_type === AnnouncementPublishType.INSTANT
        ? AnnouncementStatus.PUBLISHED
        : AnnouncementStatus.SCHEDULED;

    const announcement = await this.announcementRepository.create(
      {
        enterprise_id: enterpriseId,
        organization_id: orgId,
        title: dto.title,
        description_html: dto.description_html,
        priority: dto.priority,
        ann_status: status,
        publish_type: dto.publish_type,
        scheduled_at: dto.scheduled_at ? new Date(dto.scheduled_at) : null,
        published_at: status === AnnouncementStatus.PUBLISHED ? new Date() : null,
        send_push: dto.send_push ?? true,
        send_email: dto.send_email ?? true,
        created_by: userId,
      },
      dto.audience,
      dto.attachments ?? [],
    );

    if (announcement.ann_status === AnnouncementStatus.PUBLISHED) {
      this.searchIndexingService.indexAnnouncement(announcement, enterpriseId, orgId);
    }
    return { id: announcement.id, status: announcement.ann_status };
  }

  async findAll(enterpriseId: string, orgId: string, query: AdminAnnouncementQueryDto) {
    const [announcements, total] = await this.announcementRepository.findAll(
      enterpriseId,
      orgId,
      query,
    );

    const ids = announcements.map((a) => a.id);
    const readCounts = await this.announcementRepository.getReadCounts(ids);

    const creatorIds = [...new Set(announcements.map((a) => a.created_by))];
    const creators = creatorIds.length
      ? await this.userRepo.findByIds(creatorIds)
      : [];
    const creatorMap = new Map(
      creators.map((u) => [u.id, `${u.first_name} ${u.last_name}`.trim()]),
    );

    const items = announcements.map((a) => ({
      id: a.id,
      title: a.title,
      priority: a.priority,
      status: a.ann_status,
      publish_type: a.publish_type,
      scheduled_at: a.scheduled_at,
      published_at: a.published_at,
      created_by_name: creatorMap.get(a.created_by) ?? null,
      read_count: readCounts[a.id] ?? 0,
      created_at: a.created_at,
    }));

    return {
      items,
      pagination: {
        page: query.page ?? 1,
        limit: query.limit ?? 20,
        total,
      },
    };
  }

  async findOne(id: string) {
    const a = await this.announcementRepository.findById(id);
    if (!a) throw new NotFoundException('Announcement not found');

    const readCounts = await this.announcementRepository.getReadCounts([id]);
    const readCount = readCounts[id] ?? 0;

    const audience = this.buildAudienceResponse(a.targets);

    return {
      id: a.id,
      title: a.title,
      description_html: a.description_html,
      priority: a.priority,
      status: a.ann_status,
      publish_type: a.publish_type,
      scheduled_at: a.scheduled_at,
      published_at: a.published_at,
      archived_at: a.archived_at,
      send_push: a.send_push,
      send_email: a.send_email,
      audience,
      attachments: a.attachments,
      analytics: {
        read_count: readCount,
      },
      created_at: a.created_at,
      updated_at: a.updated_at,
    };
  }

  async update(
    id: string,
    userId: string,
    dto: UpdateAnnouncementDto,
  ) {
    const a = await this.announcementRepository.findById(id);
    if (!a) throw new NotFoundException('Announcement not found');

    this.auditContext.setPreValue(a as unknown as Record<string, unknown>);

    if (!EDITABLE_STATUSES.includes(a.ann_status)) {
      throw new ForbiddenException(
        `Announcement in status "${a.ann_status}" cannot be edited`,
      );
    }

    if (dto.publish_type === AnnouncementPublishType.SCHEDULED && dto.scheduled_at) {
      if (new Date(dto.scheduled_at) <= new Date()) {
        throw new BadRequestException('scheduled_at must be a future date');
      }
    }

    const changes: any = {};
    if (dto.title !== undefined) changes.title = dto.title;
    if (dto.description_html !== undefined) changes.description_html = dto.description_html;
    if (dto.priority !== undefined) changes.priority = dto.priority;
    if (dto.publish_type !== undefined) changes.publish_type = dto.publish_type;
    if (dto.scheduled_at !== undefined) changes.scheduled_at = new Date(dto.scheduled_at);
    if (dto.send_push !== undefined) changes.send_push = dto.send_push;
    if (dto.send_email !== undefined) changes.send_email = dto.send_email;

    const updated = await this.announcementRepository.update(
      a,
      changes,
      dto.audience,
      dto.attachments,
      userId,
    );

    return { id: updated.id, status: updated.ann_status };
  }

  async publish(id: string, userId: string) {
    const a = await this.announcementRepository.findById(id);
    if (!a) throw new NotFoundException('Announcement not found');

    if (a.ann_status === AnnouncementStatus.ARCHIVED) {
      throw new ForbiddenException('Archived announcements cannot be published');
    }
    if (a.ann_status === AnnouncementStatus.PUBLISHED) {
      return { id: a.id, status: a.ann_status };
    }

    await this.announcementRepository.update(a, {
      ann_status: AnnouncementStatus.PUBLISHED,
      published_at: new Date(),
      updated_by: userId,
    });

    this.searchIndexingService.indexAnnouncement(a, a.enterprise_id, a.organization_id);
    return { id: a.id, status: AnnouncementStatus.PUBLISHED };
  }

  async archive(id: string, userId: string) {
    const a = await this.announcementRepository.findById(id);
    if (!a) throw new NotFoundException('Announcement not found');

    if (a.ann_status !== AnnouncementStatus.PUBLISHED) {
      throw new ForbiddenException('Only published announcements can be archived');
    }

    await this.announcementRepository.update(a, {
      ann_status: AnnouncementStatus.ARCHIVED,
      archived_at: new Date(),
      updated_by: userId,
    });

    this.searchIndexingService.removeAnnouncement(a.id, a.enterprise_id);
    return { id: a.id, status: AnnouncementStatus.ARCHIVED };
  }

  async remove(id: string, userId: string) {
    const a = await this.announcementRepository.findById(id);
    if (!a) throw new NotFoundException('Announcement not found');

    if (a.ann_status !== AnnouncementStatus.DRAFT) {
      throw new ForbiddenException('Only draft announcements can be deleted');
    }

    this.auditContext.setPreValue(a as unknown as Record<string, unknown>);
    await this.announcementRepository.softDelete(a, userId);
    return { success: true };
  }

  private buildAudienceResponse(targets: any[]) {
    if (!targets || targets.length === 0) return { type: 'ALL' };

    const first = targets[0];
    if (first.target_type === 'ALL') return { type: 'ALL' };
    if (first.target_type === 'DEPARTMENT') {
      return { type: 'DEPARTMENTS', department_ids: targets.map((t) => t.target_id) };
    }
    if (first.target_type === 'LOCATION') {
      return { type: 'LOCATIONS', location_ids: targets.map((t) => t.target_id) };
    }
    if (first.target_type === 'EMPLOYEE') {
      return { type: 'EMPLOYEES', employee_ids: targets.map((t) => t.target_id) };
    }
    return { type: 'ALL' };
  }
}
