import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OrgSetupService } from './org-setup.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Organization } from '../organization/entities/organization.entity';

@Injectable()
export class OrgSetupCron {
  private readonly logger = new Logger(OrgSetupCron.name);

  constructor(
    private readonly orgSetupService: OrgSetupService,
    @InjectRepository(Organization)
    private orgRepo: Repository<Organization>,
  ) {}

  /**
   * Runs daily at midnight to check for organizations that haven't
   * completed their setup or haven't added employees after 3 days.
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async checkOrgSetupProgress() {
    this.logger.log('Running daily organization setup progress check...');
    
    // Future implementation:
    // 1. Fetch organizations created within the last 14 days.
    // 2. Loop through and call getSetupStatus(org.id)
    // 3. If completionPercentage < 100 and created > 3 days ago, emit nudge event.
    // 4. E.g. if (!steps.EMPLOYEES) -> NotificationQueue.ADD_EMPLOYEE_NUDGE
    
    this.logger.log('Organization setup progress check complete.');
  }
}
