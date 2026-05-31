import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import {
  OrganizationSubscription,
  SubscriptionStatus,
} from '../../plan/entities/organization-subscription.entity';
import { Status } from 'src/common/enums';

const REMINDER_OFFSETS_DAYS = [7, 3, 1];

@Injectable()
export class TrialReminderCron {
  private readonly logger = new Logger(TrialReminderCron.name);

  constructor(
    @InjectRepository(OrganizationSubscription)
    private readonly subRepo: Repository<OrganizationSubscription>,
  ) {}

  // Daily 09:00 server time. For each trial sub, emit a reminder at T-7/T-3/T-1.
  @Cron('0 0 9 * * *')
  async run(): Promise<void> {
    for (const offset of REMINDER_OFFSETS_DAYS) {
      const target = new Date();
      target.setDate(target.getDate() + offset);
      const dayStart = startOfDay(target);
      const dayEnd = endOfDay(target);

      const subs = await this.subRepo.find({
        where: {
          status: Status.ACTIVE,
          sub_status: SubscriptionStatus.TRIAL,
          end_date: Between(dayStart, dayEnd),
        },
      });
      for (const sub of subs) {
        // TODO wire NotificationService once the email template/channel is decided.
        this.logger.log(
          `Trial reminder T-${offset} for org ${sub.organization_id} (sub ${sub.id})`,
        );
      }
    }
  }
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}
