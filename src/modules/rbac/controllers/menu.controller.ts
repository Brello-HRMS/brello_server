import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../core/guards/jwt-auth.guard';
import { PermissionResolverService } from '../services/permission-resolver.service';
import { LoggedInUser } from '../../../common/decorators/logged-in-user.decorator';
import type { LoggedInUser as LoggedInUserInterface } from '../../auth/interfaces/logged-in-user.interface';

interface MenuNode {
  id: string;
  name: string;
  wbs_code: string;
  actions: string[];
  children: MenuNode[];
}

/**
 * MenuController
 *
 * GET /menu — Returns the user's accessible module tree for the current app.
 *
 * The tree is built from the PermissionResolver result, filtered to only
 * include modules the user can actually access, then structured hierarchically
 * using WBS codes (parent_id relationships).
 */
@Controller('menu')
export class MenuController {
  constructor(private readonly permissionResolver: PermissionResolverService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async getMenu(@LoggedInUser() user: LoggedInUserInterface): Promise<MenuNode[]> {
    const resolved = await this.permissionResolver.resolve(user);

    // Build flat lookup
    const nodeMap = new Map<string, MenuNode>();
    for (const mod of resolved.modules) {
      nodeMap.set(mod.id, {
        id: mod.id,
        name: mod.name,
        wbs_code: mod.wbs_code,
        actions: [...mod.actions],
        children: [],
      });
    }

    // Build tree — attach children to their parents
    const roots: MenuNode[] = [];
    for (const mod of resolved.modules) {
      const node = nodeMap.get(mod.id)!;
      if (mod.parent_id && nodeMap.has(mod.parent_id)) {
        nodeMap.get(mod.parent_id)!.children.push(node);
      } else {
        roots.push(node);
      }
    }

    // Sort by WBS code at each level
    const sortByWbs = (nodes: MenuNode[]) => {
      nodes.sort((a, b) =>
        a.wbs_code.localeCompare(b.wbs_code, undefined, { numeric: true }),
      );
      nodes.forEach((n) => sortByWbs(n.children));
    };
    sortByWbs(roots);

    return roots;
  }
}
