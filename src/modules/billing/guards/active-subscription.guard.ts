import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { OrganizationSubscriptionRepository } from '../../plan/repositories/organization-subscription.repository';
import { SubscriptionStatus } from '../../plan/entities/organization-subscription.entity';
import { RESTRICTED_ON_EXPIRY_KEY } from '../decorators/restricted-on-expiry.decorator';

// Blocks @RestrictedOnExpiry() routes when the org's subscription is EXPIRED beyond grace.
@Injectable()
export class ActiveSubscriptionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly subRepo: OrganizationSubscriptionRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const restricted = this.reflector.getAllAndOverride<boolean>(
      RESTRICTED_ON_EXPIRY_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!restricted) return true;

    const req = context.switchToHttp().getRequest();
    const user = req.user;
    if (!user?.organizationId) return true;

    const sub = await this.subRepo.findActiveByOrganization(user.organizationId);
    if (!sub) return true;

    if (sub.sub_status === SubscriptionStatus.EXPIRED) {
      throw new ForbiddenException({
        errorCode: 'SUBSCRIPTION_EXPIRED',
        message:
          'Your Brello subscription has expired. Renew now to continue accessing this feature.',
        renew_url: '/settings/billing/plan',
        contact_url: '/settings/billing/support',
      });
    }
    return true;
  }
}
