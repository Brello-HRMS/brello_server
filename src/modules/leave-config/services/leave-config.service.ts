import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { LeaveConfigRepository } from '../repositories/leave-config.repository';
import { CreateLeaveConfigDto } from '../dto/create-leave-config.dto';
import { UpdateLeaveConfigDto } from '../dto/update-leave-config.dto';
import { LeaveConfig } from '../entities/leave-config.entity';
import { LoggedInUser } from '../../auth/interfaces/logged-in-user.interface';
import { Status } from '../../../common/enums';

@Injectable()
export class LeaveConfigService {
  private readonly logger = new Logger(LeaveConfigService.name);

  constructor(private readonly configRepo: LeaveConfigRepository) {}

  /**
   * Creates a draft leave configuration.
   */
  async createDraft(user: LoggedInUser, dto: CreateLeaveConfigDto): Promise<{ id: string }> {
    const config = await this.configRepo.create({
      leave_year_start_month: dto.leaveYearStartMonth,
      total_leave: dto.totalLeave,
      status: Status.PENDING, // Draft
      organization_id: user.organizationId,
      enterprise_id: user.enterpriseId,
      modified_by: user.userId,
    });

    this.logger.log(`Leave configuration draft created with ID: ${config.id} by user: ${user.userId}`);
    return { id: config.id };
  }

  /**
   * Updates an existing leave configuration (Stepper Save).
   * Uses REPLACE strategy for leave types.
   */
  async updateConfig(user: LoggedInUser, id: string, dto: UpdateLeaveConfigDto): Promise<LeaveConfig> {
    const existingConfig = await this.findOne(user, id);

    const configData: Partial<LeaveConfig> = {
      modified_by: user.userId,
      ...(dto.leaveYearStartMonth !== undefined && { leave_year_start_month: dto.leaveYearStartMonth }),
      ...(dto.totalLeave !== undefined && { total_leave: dto.totalLeave }),
    };

    const leaveTypesData = dto.leaveTypes?.map((type) => ({
      ...type,
      allow_half_day: type.allowHalfDay,
      organization_id: user.organizationId,
      enterprise_id: user.enterpriseId,
      modified_by: user.userId,
    }));

    const rulesData = dto.rules
      ? {
          approval_required: dto.rules.approvalRequired,
          max_per_month: dto.rules.maxPerMonth,
          allow_half_day: dto.rules.allowHalfDay,
          allow_backdated: dto.rules.allowBackdated,
          max_backdated_days: dto.rules.maxBackdatedDays,
          sandwich_rule: dto.rules.sandwichRule,
          organization_id: user.organizationId,
          enterprise_id: user.enterpriseId,
          modified_by: user.userId,
        }
      : undefined;

    const updatedConfig = await this.configRepo.updateWithRelations(
      id,
      configData,
      leaveTypesData,
      rulesData,
    );

    if (!updatedConfig) {
      throw new NotFoundException(`Leave configuration ${id} not found after update`);
    }

    return updatedConfig;
  }

  /**
   * Activates a leave configuration after performing critical validations.
   */
  async activateConfig(user: LoggedInUser, id: string): Promise<void> {
    const config = await this.findOne(user, id);

    // 1. Total Leave Validation
    if (!config.total_leave || config.total_leave <= 0) {
      throw new BadRequestException('INVALID_TOTAL_LEAVE: Total leave must be greater than 0');
    }

    // 2. Allocation Validation (CRITICAL)
    const allocatedDays = config.leave_types?.reduce((sum, type) => sum + type.days, 0) || 0;
    if (allocatedDays !== config.total_leave) {
      throw new BadRequestException(
        `ALLOCATION_MISMATCH: Allocated leave (${allocatedDays}) must equal total leave (${config.total_leave})`,
      );
    }

    // 3. Backdated Rule Validation
    if (config.rules?.allow_backdated && !config.rules?.max_backdated_days) {
      throw new BadRequestException(
        'INVALID_BACKDATED_CONFIG: Max backdated days must be specified if backdated leave is allowed',
      );
    }

    // 4. Max Per Month Validation
    if (config.rules?.max_per_month !== undefined && config.rules?.max_per_month < 0) {
      throw new BadRequestException('INVALID_MAX_PER_MONTH: Max per month cannot be negative');
    }

    // Update status to ACTIVE
    await this.configRepo.update(id, {
      status: Status.ACTIVE,
      modified_by: user.userId,
    });

    this.logger.log(`Leave configuration ${id} activated by user: ${user.userId}`);
  }

  /**
   * Retrieves a leave configuration with its relations.
   */
  async findOne(user: LoggedInUser, id: string): Promise<LeaveConfig> {
    const config = await this.configRepo.findOneWithRelations(id, user.organizationId);
    if (!config) {
      throw new NotFoundException(`Leave configuration with ID ${id} not found`);
    }
    return config;
  }
}
