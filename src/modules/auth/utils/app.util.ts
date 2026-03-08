import { ForbiddenException } from '@nestjs/common';
import { Status } from 'src/common/enums';
import { UserRoleMap } from 'src/modules/rbac/entities/user-role-map.entity';
import { Repository } from 'typeorm';

function determineDefaultApp(
  lastAccessAppId: string | null,
  availableApps: { id: string; name: string; priority: number }[],
): string {
  if (
    lastAccessAppId &&
    availableApps.some((app) => app.id === lastAccessAppId)
  ) {
    return lastAccessAppId;
  }
  return availableApps.length > 0 ? availableApps[0].id : '';
}

async function getUserAvailableApps(
  userId: string,
  organizationId: string,
  isPlatformAdmin: boolean,
  userRoleMapRepository: Repository<UserRoleMap>,
) {
  const userRoleMaps = await userRoleMapRepository
    .createQueryBuilder('urm')
    .innerJoinAndSelect('urm.role', 'role')
    .innerJoinAndSelect('role.app', 'app')
    .where('urm.user_id = :userId', { userId })
    .andWhere('urm.organization_id = :orgId', { orgId: organizationId })
    .andWhere('role.status = :roleStatus', { roleStatus: Status.ACTIVE })
    .andWhere('app.status = :appStatus', { appStatus: Status.ACTIVE })
    .getMany();

  if (!userRoleMaps.length && !isPlatformAdmin) {
    throw new ForbiddenException(
      'No active roles assigned. Contact your administrator.',
    );
  }

  const appMap = new Map<
    string,
    { id: string; name: string; priority: number }
  >();
  for (const urm of userRoleMaps) {
    const app = urm.role.app;
    if (!appMap.has(app.id)) {
      appMap.set(app.id, {
        id: app.id,
        name: app.name,
        priority: app.priority,
      });
    }
  }
  return [...appMap.values()].sort((a, b) => a.priority - b.priority);
}

export { determineDefaultApp, getUserAvailableApps };
