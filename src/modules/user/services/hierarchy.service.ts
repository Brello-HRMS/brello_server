import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { UserRepository } from '../repositories/user.repository';
import { User } from '../entities/user.entity';
import { LoggedInUser } from '../../auth/interfaces/logged-in-user.interface';
import { HierarchyNode, MyHierarchy } from '../interfaces/hierarchy.interface';

/**
 * HierarchyService
 *
 * Builds the company reporting structure from the self-referencing
 * `reports_to_id` column on the users table. All users for the caller's
 * org/enterprise are loaded once and the tree is assembled in memory, which
 * keeps every read (tree / reportees / managers / me) to a single query.
 */
@Injectable()
export class HierarchyService {
  private readonly logger = new Logger(HierarchyService.name);

  constructor(private readonly userRepository: UserRepository) {}

  // ── Public API ─────────────────────────────────────────────────────────────

  /** Full org tree — roots are users whose manager is empty or outside the org. */
  async getOrgTree(loggedInUser: LoggedInUser): Promise<HierarchyNode[]> {
    this.logger.log(
      `Building org tree for org=${loggedInUser.organizationId} enterprise=${loggedInUser.enterpriseId}`,
    );
    const { byId, childrenOf } = await this.loadGraph(loggedInUser);

    const roots = [...byId.values()].filter(
      (u) => !u.reports_to_id || !byId.has(u.reports_to_id),
    );

    return roots
      .map((u) => this.buildNode(u, byId, childrenOf, true))
      .sort(sortByName);
  }

  /**
   * Reportees of a user. Direct reportees by default; the full subtree when
   * `recursive` is true.
   */
  async getReportees(
    userId: string,
    loggedInUser: LoggedInUser,
    recursive = false,
  ): Promise<HierarchyNode[]> {
    const { byId, childrenOf } = await this.loadGraph(loggedInUser);
    this.assertExists(userId, byId);

    const directs = (childrenOf.get(userId) ?? []).sort(sortUsersByName);
    return directs.map((u) => this.buildNode(u, byId, childrenOf, recursive));
  }

  /** Manager chain from the direct manager (first) up to the top (last). */
  async getManagerChain(
    userId: string,
    loggedInUser: LoggedInUser,
  ): Promise<HierarchyNode[]> {
    const { byId, childrenOf } = await this.loadGraph(loggedInUser);
    this.assertExists(userId, byId);

    const chain: HierarchyNode[] = [];
    const seen = new Set<string>([userId]);
    let current = byId.get(userId);

    while (current?.reports_to_id && byId.has(current.reports_to_id)) {
      const managerId = current.reports_to_id;
      if (seen.has(managerId)) break; // guard against cycles
      seen.add(managerId);
      const manager = byId.get(managerId)!;
      chain.push(this.buildNode(manager, byId, childrenOf, false));
      current = manager;
    }

    return chain;
  }

  /**
   * The logged-in user's own view: their reportee subtree plus the manager
   * chain above them. Powers the employee self-service "My Team" page.
   */
  async getMyHierarchy(loggedInUser: LoggedInUser): Promise<MyHierarchy> {
    const userId = loggedInUser.userId;
    const { byId, childrenOf } = await this.loadGraph(loggedInUser);
    this.assertExists(userId, byId);

    const self = this.buildNode(byId.get(userId)!, byId, childrenOf, true);
    const managers = await this.getManagerChain(userId, loggedInUser);

    return { self, managers };
  }

  // ── Internals ──────────────────────────────────────────────────────────────

  /** Load all org users into id→user and managerId→directReports maps. */
  private async loadGraph(loggedInUser: LoggedInUser): Promise<{
    byId: Map<string, User>;
    childrenOf: Map<string, User[]>;
  }> {
    const users = await this.userRepository.findAllForHierarchy(
      loggedInUser.organizationId,
      loggedInUser.enterpriseId,
    );

    const byId = new Map<string, User>();
    const childrenOf = new Map<string, User[]>();

    for (const user of users) byId.set(user.id, user);

    for (const user of users) {
      const managerId = user.reports_to_id;
      if (managerId && byId.has(managerId)) {
        const list = childrenOf.get(managerId) ?? [];
        list.push(user);
        childrenOf.set(managerId, list);
      }
    }

    return { byId, childrenOf };
  }

  /** Convert a User into a HierarchyNode, optionally recursing into reportees. */
  private buildNode(
    user: User,
    byId: Map<string, User>,
    childrenOf: Map<string, User[]>,
    recurse: boolean,
    visited = new Set<string>(),
  ): HierarchyNode {
    visited.add(user.id);
    const directs = childrenOf.get(user.id) ?? [];

    const children: HierarchyNode[] =
      recurse && directs.length
        ? directs
            .filter((c) => !visited.has(c.id)) // cycle guard
            .sort(sortUsersByName)
            .map((c) => this.buildNode(c, byId, childrenOf, true, visited))
        : [];

    return {
      id: user.id,
      firstName: user.first_name,
      middleName: user.middle_name ?? null,
      lastName: user.last_name,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone ?? null,
      status: user.status,
      designation: user.designation?.title ?? null,
      department: user.department?.name ?? null,
      avatar: buildAvatarUrl(user),
      reportsToId: user.reports_to_id ?? null,
      directReportsCount: directs.length,
      totalReportsCount: countSubtree(user.id, childrenOf),
      children,
    };
  }

  private assertExists(userId: string, byId: Map<string, User>): void {
    if (!byId.has(userId)) {
      throw new NotFoundException(
        `User with ID '${userId}' not found in this organization`,
      );
    }
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildAvatarUrl(user: User): string | null {
  const photo = user.user_profile?.photo;
  if (!photo?.bucket || !photo?.object_key) return null;
  const region = 'us-east-1';
  return `https://${photo.bucket}.s3.${region}.amazonaws.com/${photo.object_key}`;
}

/** Count everyone at any depth beneath `userId` (cycle-safe). */
function countSubtree(userId: string, childrenOf: Map<string, User[]>): number {
  let total = 0;
  const stack = [...(childrenOf.get(userId) ?? [])];
  const seen = new Set<string>([userId]);
  while (stack.length) {
    const node = stack.pop()!;
    if (seen.has(node.id)) continue;
    seen.add(node.id);
    total += 1;
    stack.push(...(childrenOf.get(node.id) ?? []));
  }
  return total;
}

function sortUsersByName(a: User, b: User): number {
  return a.fullName.localeCompare(b.fullName);
}

function sortByName(a: HierarchyNode, b: HierarchyNode): number {
  return a.fullName.localeCompare(b.fullName);
}
