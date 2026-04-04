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
import { Status } from '../../../common/enums';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { LoggedInUser } from '../../auth/interfaces/logged-in-user.interface';

@Injectable()
export class WeeklyOffService {
  private readonly logger = new Logger(WeeklyOffService.name);

  constructor(
    private readonly weeklyOffRepo: WeeklyOffRepository,
    private readonly ruleRepo: AttendanceRuleRepository,
  ) {}

  async create(user: LoggedInUser, dto: CreateWeeklyOffDto): Promise<{ id: string }> {
    const weeklyOff = await this.weeklyOffRepo.create({
      ...dto,
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
    return (await this.weeklyOffRepo.update(id, { ...dto, modified_by: user.userId }))!;
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

    this.logger.log(`Weekly off ${id} status changed to ${dto.status} by ${user.userId}`);
  }
}
