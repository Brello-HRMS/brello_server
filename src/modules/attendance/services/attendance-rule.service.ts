import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AttendanceRuleRepository } from '../repositories/attendance-rule.repository';
import { ShiftRepository } from '../repositories/shift.repository';
import { WeeklyOffRepository } from '../repositories/weekly-off.repository';
import { CreateAttendanceRuleDto } from '../dto/create-attendance-rule.dto';
import { UpdateAttendanceRuleDto } from '../dto/update-attendance-rule.dto';
import { ChangeStatusDto } from '../dto/change-status.dto';
import { AttendanceRule } from '../entities/attendance-rule.entity';
import { Shift } from '../entities/shift.entity';
import { GeoFence } from '../entities/geo-fence.entity';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { LoggedInUser } from '../../auth/interfaces/logged-in-user.interface';
import { AuditContextService } from '../../audit/services/audit-context.service';

@Injectable()
export class AttendanceRuleService {
  private readonly logger = new Logger(AttendanceRuleService.name);

  constructor(
    private readonly ruleRepo: AttendanceRuleRepository,
    private readonly shiftRepo: ShiftRepository,
    private readonly weeklyOffRepo: WeeklyOffRepository,
    @InjectRepository(GeoFence)
    private readonly geoFenceRepository: Repository<GeoFence>,
    private readonly auditContext: AuditContextService,
  ) {}

  async create(
    user: LoggedInUser,
    dto: CreateAttendanceRuleDto,
  ): Promise<{ id: string }> {
    const { shift } = await this.validateReferences(user, dto);

    // Inherit working-hour thresholds from the shift when not explicitly provided
    const full_day_hours = dto.full_day_hours ?? shift?.full_day_hours;
    const half_day_hours = dto.half_day_hours ?? shift?.half_day_hours;

    if (!full_day_hours || !half_day_hours) {
      throw new BadRequestException(
        'full_day_hours and half_day_hours are required (set them on the shift or provide them here)',
      );
    }

    this.validateHoursRelation({ ...dto, full_day_hours, half_day_hours });

    const rule = await this.ruleRepo.create({
      name: dto.name,
      shift_id: dto.shift_id,
      weekly_off_id: dto.weekly_off_id,
      full_day_hours,
      half_day_hours,
      overtime_after_hours: dto.overtime_after_hours,
      overtime_multiplier: dto.overtime_multiplier,
      allow_multiple_checkins: dto.allow_multiple_checkins,
      require_geo_fencing: dto.require_geo_fencing,
      organization_id: user.organizationId,
      enterprise_id: user.enterpriseId,
      modified_by: user.userId,
    });

    if (dto.require_geo_fencing && dto.geo_fence) {
      await this.geoFenceRepository.save(
        this.geoFenceRepository.create({
          rule_id: rule.id,
          office_name: dto.geo_fence.office_name,
          latitude: dto.geo_fence.latitude,
          longitude: dto.geo_fence.longitude,
          radius_meters: dto.geo_fence.radius_meters,
          organization_id: user.organizationId,
          enterprise_id: user.enterpriseId,
          modified_by: user.userId,
        }),
      );
    }

    this.logger.log(`Attendance rule "${rule.name}" created by ${user.userId}`);
    return { id: rule.id };
  }

  async findAll(
    user: LoggedInUser,
    pagination: PaginationDto,
  ): Promise<{
    data: AttendanceRule[];
    pagination: { page: number; limit: number; total: number };
  }> {
    const { data, total } = await this.ruleRepo.findAllByOrg(
      user.organizationId,
      pagination,
    );
    return {
      data,
      pagination: {
        page: pagination.page ?? 1,
        limit: pagination.limit ?? 20,
        total,
      },
    };
  }

  async findOne(user: LoggedInUser, id: string): Promise<AttendanceRule> {
    const rule = await this.ruleRepo.findOneByOrg(id, user.organizationId);
    if (!rule) {
      throw new NotFoundException(`Attendance rule ${id} not found`);
    }
    return rule;
  }

  async update(
    user: LoggedInUser,
    id: string,
    dto: UpdateAttendanceRuleDto,
  ): Promise<AttendanceRule> {
    const existingRule = await this.findOne(user, id);
    this.auditContext.setPreValue(existingRule as unknown as Record<string, unknown>);

    if (dto.shift_id || dto.weekly_off_id) {
      await this.validateReferences(user, {
        shift_id: dto.shift_id ?? existingRule.shift_id,
        weekly_off_id: dto.weekly_off_id ?? existingRule.weekly_off_id,
      });
    }

    if (dto.full_day_hours !== undefined || dto.half_day_hours !== undefined) {
      this.validateHoursRelation({
        full_day_hours: dto.full_day_hours ?? existingRule.full_day_hours,
        half_day_hours: dto.half_day_hours ?? existingRule.half_day_hours,
        overtime_after_hours:
          dto.overtime_after_hours ?? existingRule.overtime_after_hours,
      });
    }

    // Handle geo-fence update
    if (dto.geo_fence !== undefined) {
      const existingGeoFence = await this.geoFenceRepository.findOne({
        where: { rule_id: id, is_deleted: false },
      });

      if (dto.geo_fence && dto.require_geo_fencing !== false) {
        if (existingGeoFence) {
          await this.geoFenceRepository.update(existingGeoFence.id, {
            ...dto.geo_fence,
            modified_by: user.userId,
          });
        } else {
          await this.geoFenceRepository.save(
            this.geoFenceRepository.create({
              rule_id: id,
              ...dto.geo_fence,
              organization_id: user.organizationId,
              enterprise_id: user.enterpriseId,
              modified_by: user.userId,
            }),
          );
        }
      } else if (existingGeoFence) {
        await this.geoFenceRepository.update(existingGeoFence.id, {
          is_deleted: true,
          deleted_at: new Date(),
          deleted_by: user.userId,
        });
      }
    }

    // Remove geo_fence from the rule update payload
    const { geo_fence, ...ruleUpdateData } = dto;
    return (await this.ruleRepo.update(id, {
      ...ruleUpdateData,
      modified_by: user.userId,
    }))!;
  }

  async changeStatus(
    user: LoggedInUser,
    id: string,
    dto: ChangeStatusDto,
  ): Promise<void> {
    await this.findOne(user, id);
    await this.ruleRepo.update(id, {
      status: dto.status,
      modified_by: user.userId,
    });
    this.logger.log(
      `[AUDIT] Attendance rule ${id} status → ${dto.status} by ${user.userId}`,
    );
  }

  async delete(user: LoggedInUser, id: string): Promise<void> {
    const rule = await this.findOne(user, id);
    this.auditContext.setPreValue(rule as unknown as Record<string, unknown>);

    const geoFence = await this.geoFenceRepository.findOne({
      where: { rule_id: id, is_deleted: false },
    });
    if (geoFence) {
      await this.geoFenceRepository.update(geoFence.id, {
        is_deleted: true,
        deleted_at: new Date(),
        deleted_by: user.userId,
      });
    }

    await this.ruleRepo.softDelete(id, user.userId);
    this.logger.log(
      `[AUDIT] Attendance rule "${rule.name}" (${id}) deleted by ${user.userId}`,
    );
  }

  private async validateReferences(
    user: LoggedInUser,
    dto: { shift_id?: string; weekly_off_id?: string },
  ): Promise<{ shift: Shift | null }> {
    let shift: Shift | null = null;

    if (dto.shift_id) {
      shift = await this.shiftRepo.findOneByOrg(
        dto.shift_id,
        user.organizationId,
      );
      if (!shift) {
        throw new NotFoundException(`Shift ${dto.shift_id} not found`);
      }
    }

    if (dto.weekly_off_id) {
      const weeklyOff = await this.weeklyOffRepo.findOneByOrg(
        dto.weekly_off_id,
        user.organizationId,
      );
      if (!weeklyOff) {
        throw new NotFoundException(
          `Weekly off ${dto.weekly_off_id} not found`,
        );
      }
    }

    return { shift };
  }

  private validateHoursRelation(dto: {
    full_day_hours?: number;
    half_day_hours?: number;
    overtime_after_hours?: number;
  }): void {
    if (
      dto.full_day_hours !== undefined &&
      dto.half_day_hours !== undefined &&
      dto.full_day_hours <= dto.half_day_hours
    ) {
      throw new BadRequestException(
        'full_day_hours must be greater than half_day_hours',
      );
    }

    if (
      dto.overtime_after_hours !== undefined &&
      dto.full_day_hours !== undefined &&
      dto.overtime_after_hours < dto.full_day_hours
    ) {
      throw new BadRequestException(
        'overtime_after_hours must be >= full_day_hours',
      );
    }
  }
}
