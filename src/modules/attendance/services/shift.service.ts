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

    if (dto.start_time || dto.end_time || dto.auto_checkout_time || dto.full_day_hours || dto.half_day_hours) {
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

  private validateShiftTimings(dto: Partial<CreateShiftDto>): void {
    if (dto.start_time && dto.end_time && dto.end_time <= dto.start_time) {
      throw new BadRequestException('end_time must be greater than start_time');
    }

    if (dto.auto_checkout_time && dto.end_time && dto.auto_checkout_time < dto.end_time) {
      throw new BadRequestException('auto_checkout_time must be >= end_time');
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
