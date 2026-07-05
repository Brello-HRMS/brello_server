import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import {
  OrganizationSubscription,
  SubscriptionStatus,
} from '../../plan/entities/organization-subscription.entity';
import { UserRoleMap } from '../../rbac/entities/user-role-map.entity';
import { User } from '../../user/entities/user.entity';
import { NotificationService } from '../../notification/services/notification.service';
import { NotificationType } from '../../../common/enums/notification-type.enum';
import { Status } from 'src/common/enums';

const REMINDER_OFFSETS_DAYS = [7, 3, 1];

@Injectable()
export class TrialReminderCron {
  private readonly logger = new Logger(TrialReminderCron.name);

  constructor(
    @InjectRepository(OrganizationSubscription)
    private readonly subRepo: Repository<OrganizationSubscription>,
    @InjectRepository(UserRoleMap)
    private readonly userRoleMapRepo: Repository<UserRoleMap>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly notificationService: NotificationService,
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
        this.logger.log(`Trial reminder T-${offset} for org ${sub.organization_id}`);

        // Notify all org users — org admin lookup via user_role_map
        const orgUsers = await this.userRoleMapRepo.find({
          where: { organization_id: sub.organization_id },
        });

        const userIds = [...new Set(orgUsers.map((m) => m.user_id))];
        if (!userIds.length) continue;

        const users = await this.userRepo
          .createQueryBuilder('u')
          .where('u.id IN (:...userIds)', { userIds })
          .getMany();

        const trialEndDate = sub.end_date
          ? new Date(sub.end_date).toLocaleDateString('en-GB', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            })
          : 'soon';

        for (const user of users) {
          await this.notificationService.send({
            user_id: user.id,
            target_email: user.email,
            title: `Your Brello trial ends in ${offset} day${offset === 1 ? '' : 's'}`,
            message: `Your trial expires on ${trialEndDate}. Upgrade to keep access.`,
            type: NotificationType.EMAIL,
            metadata: {
              template: 'trial-reminder',
              organizationName: sub.organization_id,
              daysRemaining: offset,
              trialEndDate,
            },
          });
        }
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
