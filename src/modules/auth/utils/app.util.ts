import { ForbiddenException } from '@nestjs/common';
import { Status } from 'src/common/enums';
import { UserRoleMap } from 'src/modules/rbac/entities/user-role-map.entity';
import { Role } from 'src/modules/role/entities/role.entity';
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
): Promise<{ id: string; name: string; priority: number }[]> {
  const hasRoles = await userRoleMapRepository
    .createQueryBuilder('urm')
    .innerJoin('urm.role', 'role')
    .where('urm.user_id = :userId', { userId })
    .andWhere('urm.organization_id = :orgId', { orgId: organizationId })
    .andWhere('role.status = :roleStatus', { roleStatus: Status.ACTIVE })
    .getCount();

  if (!hasRoles && !isPlatformAdmin) {
    throw new ForbiddenException(
      'No active roles assigned. Contact your administrator.',
    );
  }

  const params = { userId, orgId: organizationId, roleStatus: Status.ACTIVE, appStatus: Status.ACTIVE };

  // Query 1: apps via role.app_id (primary)
  const primaryApps: { id: string; name: string; priority: number }[] =
    await userRoleMapRepository
      .createQueryBuilder('urm')
      .select('app.id', 'id')
      .addSelect('app.name', 'name')
      .addSelect('app.priority', 'priority')
      .innerJoin('urm.role', 'role')
      .innerJoin('role.app', 'app')
      .where('urm.user_id = :userId', params)
      .andWhere('urm.organization_id = :orgId', params)
      .andWhere('role.status = :roleStatus', params)
      .andWhere('app.status = :appStatus', params)
      .distinct(true)
      .getRawMany();

  // Query 2: extra apps via role_apps junction table on org role
  const extraApps: { id: string; name: string; priority: number }[] =
    await userRoleMapRepository
      .createQueryBuilder('urm')
      .select('extraApp.id', 'id')
      .addSelect('extraApp.name', 'name')
      .addSelect('extraApp.priority', 'priority')
      .innerJoin('urm.role', 'role')
      .innerJoin('role.roleApps', 'roleApp')
      .innerJoin('roleApp.app', 'extraApp')
      .where('urm.user_id = :userId', params)
      .andWhere('urm.organization_id = :orgId', params)
      .andWhere('role.status = :roleStatus', params)
      .andWhere('extraApp.status = :appStatus', params)
      .distinct(true)
      .getRawMany();

  // Query 3: apps from matching platform template role's role_apps
  // Handles existing org roles cloned before role_apps were introduced
  const templateApps: { id: string; name: string; priority: number }[] =
    await userRoleMapRepository
      .createQueryBuilder('urm')
      .select('tplApp.id', 'id')
      .addSelect('tplApp.name', 'name')
      .addSelect('tplApp.priority', 'priority')
      .innerJoin('urm.role', 'orgRole')
      .innerJoin(
        Role,
        'tplRole',
        'tplRole.name = orgRole.name AND tplRole.organization_id IS NULL AND tplRole.status = :tplStatus',
        { tplStatus: Status.ACTIVE },
      )
      .innerJoin('tplRole.roleApps', 'tplRoleApp')
      .innerJoin('tplRoleApp.app', 'tplApp')
      .where('urm.user_id = :userId', params)
      .andWhere('urm.organization_id = :orgId', params)
      .andWhere('orgRole.status = :roleStatus', params)
      .andWhere('tplApp.status = :appStatus', params)
      .distinct(true)
      .getRawMany();

  const appMap = new Map<string, { id: string; name: string; priority: number }>();
  for (const row of [...primaryApps, ...extraApps, ...templateApps]) {
    if (!appMap.has(row.id)) {
      appMap.set(row.id, { id: row.id, name: row.name, priority: Number(row.priority) });
    }
  }

  return [...appMap.values()].sort((a, b) => a.priority - b.priority);
}

export { determineDefaultApp, getUserAvailableApps };
