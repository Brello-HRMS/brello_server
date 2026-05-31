import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import {
  OrganizationSubscription,
  SubscriptionStatus,
} from '../../plan/entities/organization-subscription.entity';
import { Status } from 'src/common/enums';

@Injectable()
export class SubscriptionExpiryCron {
  private readonly logger = new Logger(SubscriptionExpiryCron.name);
  private readonly graceDays: number;

  constructor(
    @InjectRepository(OrganizationSubscription)
    private readonly subRepo: Repository<OrganizationSubscription>,
    private readonly config: ConfigService,
  ) {
    this.graceDays = Number(this.config.get('billing.GRACE_PERIOD_DAYS') ?? 7);
  }

  // Daily 03:00 server time. Two passes:
  //  1) TRIAL/ACTIVE past end_date → GRACE
  //  2) GRACE past grace_period_ends_at → EXPIRED
  @Cron('0 0 3 * * *')
  async run(): Promise<void> {
    const now = new Date();
    const trialsToGrace = await this.subRepo.find({
      where: [
        {
          status: Status.ACTIVE,
          sub_status: SubscriptionStatus.TRIAL,
          end_date: LessThan(now),
        },
        {
          status: Status.ACTIVE,
          sub_status: SubscriptionStatus.ACTIVE,
          end_date: LessThan(now),
        },
      ],
    });
    for (const sub of trialsToGrace) {
      const graceEnd = new Date(now);
      graceEnd.setDate(graceEnd.getDate() + this.graceDays);
      sub.sub_status = SubscriptionStatus.GRACE;
      sub.grace_period_ends_at = graceEnd;
      await this.subRepo.save(sub);
      this.logger.log(`Sub ${sub.id} → GRACE (org ${sub.organization_id})`);
    }

    const graceToExpired = await this.subRepo.find({
      where: {
        status: Status.ACTIVE,
        sub_status: SubscriptionStatus.GRACE,
        grace_period_ends_at: LessThan(now),
      },
    });
    for (const sub of graceToExpired) {
      sub.sub_status = SubscriptionStatus.EXPIRED;
      await this.subRepo.save(sub);
      this.logger.log(`Sub ${sub.id} → EXPIRED (org ${sub.organization_id})`);
    }
  }
}
