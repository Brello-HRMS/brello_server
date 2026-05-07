import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { ShiftRepository } from '../repositories/shift.repository';
import { AttendanceRuleRepository } from '../repositories/attendance-rule.repository';
import { CreateShiftDto } from '../dto/create-shift.dto';
import { UpdateShiftDto } from '../dto/update-shift.dto';
import { ChangeStatusDto } from '../dto/change-status.dto';
import { Shift } from '../entities/shift.entity';
import { Status } from '../../../common/enums';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { LoggedInUser } from '../../auth/interfaces/logged-in-user.interface';

@Injectable()
export class ShiftService {
  private readonly logger = new Logger(ShiftService.name);

  constructor(
    private readonly shiftRepo: ShiftRepository,
    private readonly ruleRepo: AttendanceRuleRepository,
  ) {}

  async create(user: LoggedInUser, dto: CreateShiftDto): Promise<{ id: string }> {
    this.validateShiftTimings(dto);

    const shift = await this.shiftRepo.create({
      ...dto,
      organization_id: user.organizationId,
      enterprise_id: user.enterpriseId,
      modified_by: user.userId,
    });

    this.logger.log(`Shift "${shift.name}" created by ${user.userId}`);
    return { id: shift.id };
  }

  async findAll(
    user: LoggedInUser,
    pagination: PaginationDto,
  ): Promise<{ data: Shift[]; pagination: { page: number; limit: number; total: number } }> {
    const { data, total } = await this.shiftRepo.findAllByOrg(user.organizationId, pagination);
    return {
      data,
      pagination: {
        page: pagination.page ?? 1,
        limit: pagination.limit ?? 20,
        total,
      },
    };
  }

  async findOne(user: LoggedInUser, id: string): Promise<Shift> {
    const shift = await this.shiftRepo.findOneByOrg(id, user.organizationId);
    if (!shift) {
      throw new NotFoundException(`Shift ${id} not found`);
    }
    return shift;
  }

  async update(user: LoggedInUser, id: string, dto: UpdateShiftDto): Promise<Shift> {
    await this.findOne(user, id);

    if (dto.start_time || dto.end_time || dto.auto_checkout_time || dto.full_day_hours || dto.half_day_hours || dto.is_night_shift !== undefined) {
      this.validateShiftTimings(dto);
    }

    return (await this.shiftRepo.update(id, { ...dto, modified_by: user.userId }))!;
  }

  async changeStatus(user: LoggedInUser, id: string, dto: ChangeStatusDto): Promise<void> {
    const shift = await this.findOne(user, id);

    if (dto.status === Status.INACTIVE) {
      const activeRuleCount = await this.ruleRepo.countActiveByShiftId(shift.id);
      if (activeRuleCount > 0) {
        throw new ConflictException(
          'Cannot deactivate shift: it is used in active attendance rules',
        );
      }
    }

    await this.shiftRepo.update(id, {
      status: dto.status,
      modified_by: user.userId,
    });

    this.logger.log(`Shift ${id} status changed to ${dto.status} by ${user.userId}`);
  }

  async delete(user: LoggedInUser, id: string): Promise<void> {
    const shift = await this.findOne(user, id);

    const activeRuleCount = await this.ruleRepo.countActiveByShiftId(shift.id);
    if (activeRuleCount > 0) {
      throw new ConflictException(
        'Cannot delete shift: it is used in active attendance rules',
      );
    }

    await this.shiftRepo.softDelete(id, user.userId);
    this.logger.log(`Shift ${id} deleted by ${user.userId}`);
  }

  private timeToMinutes(time: string): number {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  }

  private validateShiftTimings(dto: Partial<CreateShiftDto>): void {
    const isNightShift = dto.is_night_shift ?? false;

    if (dto.start_time && dto.end_time) {
      const startMins = this.timeToMinutes(dto.start_time);
      const endMins = this.timeToMinutes(dto.end_time);

      if (!isNightShift && endMins <= startMins) {
        throw new BadRequestException('end_time must be greater than start_time');
      }
      if (isNightShift && endMins >= startMins) {
        throw new BadRequestException(
          'For a night shift, end_time must be earlier than start_time (shift must cross midnight)',
        );
      }
    }

    if (dto.auto_checkout_time && dto.end_time) {
      let endMins = this.timeToMinutes(dto.end_time);
      let autoMins = this.timeToMinutes(dto.auto_checkout_time);

      if (isNightShift && dto.start_time) {
        const startMins = this.timeToMinutes(dto.start_time);
        // Times earlier than start_time are on the next calendar day
        if (endMins < startMins) endMins += 1440;
        if (autoMins < startMins) autoMins += 1440;
      }

      if (autoMins < endMins) {
        throw new BadRequestException('auto_checkout_time must be >= end_time');
      }
    }

    if (
      dto.full_day_hours !== undefined &&
      dto.half_day_hours !== undefined &&
      dto.full_day_hours <= dto.half_day_hours
    ) {
      throw new BadRequestException('full_day_hours must be greater than half_day_hours');
    }
  }
}
