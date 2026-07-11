import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import { Announcement } from '../entities/announcement.entity';
import { AnnouncementTarget } from '../entities/announcement-target.entity';
import { AnnouncementRead } from '../entities/announcement-read.entity';
import { AnnouncementAttachment } from '../entities/announcement-attachment.entity';
import {
  AnnouncementStatus,
  AnnouncementTargetType,
} from '../enums/announcement.enum';
import { AdminAnnouncementQueryDto } from '../dto/admin-query.dto';
import { AttachmentDto, AudienceDto } from '../dto/create-announcement.dto';

@Injectable()
export class AnnouncementRepository {
  constructor(
    @InjectRepository(Announcement)
    private readonly repo: Repository<Announcement>,
    @InjectRepository(AnnouncementTarget)
    private readonly targetRepo: Repository<AnnouncementTarget>,
    @InjectRepository(AnnouncementRead)
    private readonly readRepo: Repository<AnnouncementRead>,
    private readonly dataSource: DataSource,
  ) {}

  async findById(id: string): Promise<Announcement | null> {
    return this.repo.findOne({
      where: { id, deleted_at: IsNull() },
      relations: ['targets', 'attachments'],
    });
  }

  async findAll(
    enterpriseId: string,
    orgId: string,
    query: AdminAnnouncementQueryDto,
  ): Promise<[Announcement[], number]> {
    const qb = this.repo
      .createQueryBuilder('a')
      .where('a.enterprise_id = :enterpriseId', { enterpriseId })
      .andWhere('a.organization_id = :orgId', { orgId })
      .andWhere('a.deleted_at IS NULL');

    if (query.status) {
      qb.andWhere('a.ann_status = :status', { status: query.status });
    }
    if (query.priority) {
      qb.andWhere('a.priority = :priority', { priority: query.priority });
    }
    if (query.search) {
      qb.andWhere('a.title LIKE :search', { search: `%${query.search}%` });
    }

    qb.orderBy('a.created_at', 'DESC');

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    qb.skip((page - 1) * limit).take(limit);

    return qb.getManyAndCount();
  }

  async getReadCounts(announcementIds: string[]): Promise<Record<string, number>> {
    if (announcementIds.length === 0) return {};

    const counts = await this.readRepo
      .createQueryBuilder('r')
      .select('r.announcement_id', 'announcement_id')
      .addSelect('COUNT(r.id)', 'count')
      .where('r.announcement_id IN (:...ids)', { ids: announcementIds })
      .groupBy('r.announcement_id')
      .getRawMany<{ announcement_id: string; count: string }>();

    const result: Record<string, number> = {};
    for (const row of counts) {
      result[row.announcement_id] = parseInt(row.count, 10);
    }
    return result;
  }

  async create(
    data: Partial<Announcement>,
    audience: AudienceDto,
    attachments: AttachmentDto[],
  ): Promise<Announcement> {
    return this.dataSource.transaction(async (manager) => {
      const announcement = manager.create(Announcement, data);
      const saved = await manager.save(Announcement, announcement);

      await this.saveTargets(manager, saved.id, audience);

      if (attachments.length > 0) {
        const attEntities = attachments.map((att) =>
          manager.create(AnnouncementAttachment, {
            announcement_id: saved.id,
            file_name: att.file_name,
            file_url: att.file_url,
            file_size: att.file_size ?? null,
            mime_type: att.mime_type ?? null,
          }),
        );
        await manager.save(AnnouncementAttachment, attEntities);
      }

      const result = await manager.findOne(Announcement, {
        where: { id: saved.id },
        relations: ['targets', 'attachments'],
      });
      return result!;
    });
  }

  async update(
    announcement: Announcement,
    changes: Partial<Announcement>,
    audience?: AudienceDto,
    attachments?: AttachmentDto[],
    actorId?: string,
  ): Promise<Announcement> {
    return this.dataSource.transaction(async (manager) => {
      Object.assign(announcement, changes);
      if (actorId) announcement.updated_by = actorId;
      await manager.save(Announcement, announcement);

      if (audience) {
        await manager.delete(AnnouncementTarget, { announcement_id: announcement.id });
        await this.saveTargets(manager, announcement.id, audience);
      }

      if (attachments !== undefined) {
        await manager.delete(AnnouncementAttachment, { announcement_id: announcement.id });
        if (attachments.length > 0) {
          const attEntities = attachments.map((att) =>
            manager.create(AnnouncementAttachment, {
              announcement_id: announcement.id,
              file_name: att.file_name,
              file_url: att.file_url,
              file_size: att.file_size ?? null,
              mime_type: att.mime_type ?? null,
            }),
          );
          await manager.save(AnnouncementAttachment, attEntities);
        }
      }

      const updated = await manager.findOne(Announcement, {
        where: { id: announcement.id },
        relations: ['targets', 'attachments'],
      });
      return updated!;
    });
  }

  async softDelete(announcement: Announcement, actorId: string): Promise<void> {
    announcement.deleted_at = new Date();
    announcement.deleted_by = actorId;
    await this.repo.save(announcement);
  }

  async findPublishedForEmployee(
    enterpriseId: string,
    orgId: string,
    employeeId: string,
    departmentId: string | null,
    locationId: string | null,
    page: number,
    limit: number,
  ): Promise<[Announcement[], number]> {
    const qb = this.repo
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.targets', 'tgt')
      .leftJoinAndSelect('a.attachments', 'att')
      .where('a.enterprise_id = :enterpriseId', { enterpriseId })
      .andWhere('a.organization_id = :orgId', { orgId })
      .andWhere("a.ann_status = 'PUBLISHED'")
      .andWhere('a.deleted_at IS NULL')
      .andWhere(
        `(
          tgt.target_type = 'ALL'
          OR (tgt.target_type = 'EMPLOYEE' AND tgt.target_id = :employeeId)
          ${departmentId ? "OR (tgt.target_type = 'DEPARTMENT' AND tgt.target_id = :departmentId)" : ''}
          ${locationId ? "OR (tgt.target_type = 'LOCATION' AND tgt.target_id = :locationId)" : ''}
        )`,
        {
          employeeId,
          ...(departmentId ? { departmentId } : {}),
          ...(locationId ? { locationId } : {}),
        },
      )
      .orderBy('a.published_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    return qb.getManyAndCount();
  }

  async getReadStatusForEmployee(
    announcementIds: string[],
    employeeId: string,
  ): Promise<Set<string>> {
    if (announcementIds.length === 0) return new Set();

    const reads = await this.readRepo.find({
      where: announcementIds.map((id) => ({ announcement_id: id, employee_id: employeeId })),
    });

    return new Set(reads.map((r) => r.announcement_id));
  }

  async upsertRead(announcementId: string, employeeId: string): Promise<void> {
    await this.readRepo
      .createQueryBuilder()
      .insert()
      .into(AnnouncementRead)
      .values({
        announcement_id: announcementId,
        employee_id: employeeId,
        viewed_at: new Date(),
      })
      .orIgnore()
      .execute();
  }

  async findDueScheduled(): Promise<Announcement[]> {
    return this.repo
      .createQueryBuilder('a')
      .where("a.ann_status = 'SCHEDULED'")
      .andWhere('a.scheduled_at <= :now', { now: new Date() })
      .andWhere('a.deleted_at IS NULL')
      .getMany();
  }

  private async saveTargets(
    manager: any,
    announcementId: string,
    audience: AudienceDto,
  ): Promise<void> {
    const targets: Partial<AnnouncementTarget>[] = [];

    if (audience.type === AnnouncementTargetType.ALL) {
      targets.push({ announcement_id: announcementId, target_type: AnnouncementTargetType.ALL, target_id: null });
    } else if (audience.type === AnnouncementTargetType.DEPARTMENT) {
      for (const id of audience.department_ids ?? []) {
        targets.push({ announcement_id: announcementId, target_type: AnnouncementTargetType.DEPARTMENT, target_id: id });
      }
    } else if (audience.type === AnnouncementTargetType.LOCATION) {
      for (const id of audience.location_ids ?? []) {
        targets.push({ announcement_id: announcementId, target_type: AnnouncementTargetType.LOCATION, target_id: id });
      }
    } else if (audience.type === AnnouncementTargetType.EMPLOYEE) {
      for (const id of audience.employee_ids ?? []) {
        targets.push({ announcement_id: announcementId, target_type: AnnouncementTargetType.EMPLOYEE, target_id: id });
      }
    }

    if (targets.length > 0) {
      await manager.save(AnnouncementTarget, targets.map((t) => manager.create(AnnouncementTarget, t)));
    }
  }
}
