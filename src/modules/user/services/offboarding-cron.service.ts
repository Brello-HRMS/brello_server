import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { LessThanOrEqual } from 'typeorm';
import { UserProfileRepository } from '../repositories/user-profile.repository';
import { EmployeeOffboardingRepository } from '../repositories/offboarding.repository';
import { EmployeeStatus } from '../enums/user.enum';
import { Status } from '../../../common/enums';

@Injectable()
export class OffboardingCronService {
  private readonly logger = new Logger(OffboardingCronService.name);

  constructor(
    private readonly profileRepository: UserProfileRepository,
    private readonly offboardingRepository: EmployeeOffboardingRepository,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleOffboarding() {
    this.logger.log('Running daily offboarding system automation...');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find all offboarding records where last_working_day <= today and not yet processed
    const pendingOffboardings = await this.offboardingRepository.find({
      where: {
        last_working_day: LessThanOrEqual(today),
        is_cancelled: false,
        // We could add a 'is_processed' flag if we want to avoid re-processing, 
        // but checking employee_status is also fine.
      },
    });

    for (const record of pendingOffboardings) {
      const profile = await this.profileRepository.findByUserId(record.user_id);
      if (profile && profile.employee_status === EmployeeStatus.OFFBOARDING) {
        this.logger.log(`Offboarding employee: ${record.user_id}`);
        
        await this.profileRepository.update(profile.id, {
          employee_status: EmployeeStatus.INACTIVE,
          status: Status.INACTIVE,
        });
      }
    }

    this.logger.log(`Processed ${pendingOffboardings.length} offboarding records.`);
  }
}
