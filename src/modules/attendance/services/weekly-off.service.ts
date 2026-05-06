import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { WeeklyOffRepository } from '../repositories/weekly-off.repository';
import { AttendanceRuleRepository } from '../repositories/attendance-rule.repository';
import { CreateWeeklyOffDto } from '../dto/create-weekly-off.dto';
import { UpdateWeeklyOffDto } from '../dto/update-weekly-off.dto';
import { ChangeStatusDto } from '../dto/change-status.dto';
import { WeeklyOff } from '../entities/weekly-off.entity';
import { DayOfWeek } from '../enums/day-of-week.enum';
import { SaturdayRule } from '../enums/saturday-rule.enum';
import { Status } from '../../../common/enums';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { LoggedInUser } from '../../auth/interfaces/logged-in-user.interface';

const NON_SAT_DAYS: DayOfWeek[] = [
  DayOfWeek.MONDAY,
  DayOfWeek.TUESDAY,
  DayOfWeek.WEDNESDAY,
  DayOfWeek.THURSDAY,
  DayOfWeek.FRIDAY,
  DayOfWeek.SUNDAY,
];

@Injectable()
export class WeeklyOffService {
  private readonly logger = new Logger(WeeklyOffService.name);

  constructor(
    private readonly weeklyOffRepo: WeeklyOffRepository,
    private readonly ruleRepo: AttendanceRuleRepository,
  ) {}

  private computeDaysOff(workingDays: string[], saturdayRule?: SaturdayRule): DayOfWeek[] {
    const upper = new Set(workingDays.map((d) => d.toUpperCase()));
    const daysOff = NON_SAT_DAYS.filter((d) => !upper.has(d));
    if (saturdayRule === SaturdayRule.ALL_OFF) {
      daysOff.push(DayOfWeek.SATURDAY);
    }
    return daysOff;
  }

  async create(user: LoggedInUser, dto: CreateWeeklyOffDto): Promise<{ id: string }> {
    const { working_days, saturday_rule, saturday_off_weeks, name } = dto;

    const weeklyOff = await this.weeklyOffRepo.create({
      name,
      days: this.computeDaysOff(working_days, saturday_rule),
      saturday_rule: saturday_rule ?? null,
      saturday_off_weeks: saturday_rule === SaturdayRule.CUSTOM ? (saturday_off_weeks ?? null) : null,
      organization_id: user.organizationId,
      enterprise_id: user.enterpriseId,
      modified_by: user.userId,
    });

    this.logger.log(`Weekly off "${weeklyOff.name}" created by ${user.userId}`);
    return { id: weeklyOff.id };
  }

  async findAll(
    user: LoggedInUser,
    pagination: PaginationDto,
  ): Promise<{ data: WeeklyOff[]; pagination: { page: number; limit: number; total: number } }> {
    const { data, total } = await this.weeklyOffRepo.findAllByOrg(user.organizationId, pagination);
    return {
      data,
      pagination: {
        page: pagination.page ?? 1,
        limit: pagination.limit ?? 20,
        total,
      },
    };
  }

  async findOne(user: LoggedInUser, id: string): Promise<WeeklyOff> {
    const weeklyOff = await this.weeklyOffRepo.findOneByOrg(id, user.organizationId);
    if (!weeklyOff) {
      throw new NotFoundException(`Weekly off ${id} not found`);
    }
    return weeklyOff;
  }

  async update(user: LoggedInUser, id: string, dto: UpdateWeeklyOffDto): Promise<WeeklyOff> {
    await this.findOne(user, id);

    const updateData: Partial<WeeklyOff> = { modified_by: user.userId };

    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.saturday_rule !== undefined) updateData.saturday_rule = dto.saturday_rule ?? null;

    if (dto.working_days !== undefined) {
      updateData.days = this.computeDaysOff(dto.working_days, dto.saturday_rule);
    }

    updateData.saturday_off_weeks =
      dto.saturday_rule === SaturdayRule.CUSTOM ? (dto.saturday_off_weeks ?? null) : null;

    return (await this.weeklyOffRepo.update(id, updateData))!;
  }

  async changeStatus(user: LoggedInUser, id: string, dto: ChangeStatusDto): Promise<void> {
    const weeklyOff = await this.findOne(user, id);

    if (dto.status === Status.INACTIVE) {
      const activeRuleCount = await this.ruleRepo.countActiveByWeeklyOffId(weeklyOff.id);
      if (activeRuleCount > 0) {
        throw new ConflictException(
          'Cannot deactivate weekly off: it is linked to active attendance rules',
        );
      }
    }

    await this.weeklyOffRepo.update(id, {
      status: dto.status,
      modified_by: user.userId,
    });

    this.logger.log(`[AUDIT] Weekly off ${id} status → ${dto.status} by ${user.userId}`);
  }

  async delete(user: LoggedInUser, id: string): Promise<void> {
    const weeklyOff = await this.findOne(user, id);

    const activeRuleCount = await this.ruleRepo.countActiveByWeeklyOffId(weeklyOff.id);
    if (activeRuleCount > 0) {
      throw new ConflictException(
        'Cannot delete weekly off: it is used in active attendance rules',
      );
    }

    await this.weeklyOffRepo.softDelete(id, user.userId);
    this.logger.log(`[AUDIT] Weekly off "${weeklyOff.name}" (${id}) deleted by ${user.userId}`);
  }
}
