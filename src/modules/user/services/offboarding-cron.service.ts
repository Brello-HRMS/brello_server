import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { LessThanOrEqual } from 'typeorm';
import { UserProfileRepository } from '../repositories/user-profile.repository';
import { UserRepository } from '../repositories/user.repository';
import { EmployeeOffboardingRepository } from '../repositories/offboarding.repository';
import { EmployeeStatus } from '../enums/user.enum';
import { Status } from '../../../common/enums';

@Injectable()
export class OffboardingCronService {
  private readonly logger = new Logger(OffboardingCronService.name);

  constructor(
    private readonly profileRepository: UserProfileRepository,
    private readonly userRepository: UserRepository,
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

    let processed = 0;
    for (const record of pendingOffboardings) {
      const profile = await this.profileRepository.findByUserId(record.user_id);
      if (profile && profile.employee_status === EmployeeStatus.OFFBOARDING) {
        this.logger.log(`Offboarding employee: ${record.user_id}`);

        await this.profileRepository.update(profile.id, {
          employee_status: EmployeeStatus.INACTIVE,
          status: Status.INACTIVE,
        });

        // The account's actual login gate is User.status, not the profile's
        // employee_status — without this, an offboarded employee keeps full
        // login access indefinitely.
        await this.userRepository.update(record.user_id, {
          status: Status.INACTIVE,
        });

        processed++;
      }
    }

    this.logger.log(`Processed ${processed} offboarding records.`);
  }
}
