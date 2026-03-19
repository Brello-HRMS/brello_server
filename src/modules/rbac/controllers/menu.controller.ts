import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../core/guards/jwt-auth.guard';
import { PermissionResolverService } from '../services/permission-resolver.service';
import { LoggedInUser } from '../../../common/decorators/logged-in-user.decorator';
import type { LoggedInUser as LoggedInUserInterface } from '../../auth/interfaces/logged-in-user.interface';

interface MenuItem {
  label: string;
  icon?: string;
  path?: string;
  children?: MenuItem[];
  actions?: string[];
}

/**
 * MenuController
 *
 * GET /menu — Returns the user's accessible module tree for the current app.
 */
@Controller('menu')
export class MenuController {
  constructor(private readonly permissionResolver: PermissionResolverService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async getMenu(@LoggedInUser() user: LoggedInUserInterface): Promise<MenuItem[]> {
    const resolved = await this.permissionResolver.resolve(user);

    // Build flat lookup
    const nodeMap = new Map<string, MenuItem & { id: string; wbs_code: string; parent_id: string | null }>();
    for (const mod of resolved.modules) {
      nodeMap.set(mod.id, {
        id: mod.id,
        label: mod.name,
        icon: mod.icon,
        path: mod.path,
        wbs_code: mod.wbs_code,
        parent_id: mod.parent_id,
        actions: [...mod.actions],
        children: [],
      });
    }

    // Build tree — attach children to their parents
    const roots: MenuItem[] = [];
    for (const mod of resolved.modules) {
      const node = nodeMap.get(mod.id)!;
      if (mod.parent_id && nodeMap.has(mod.parent_id)) {
        nodeMap.get(mod.parent_id)!.children!.push(node);
      } else {
        roots.push(node);
      }
    }

    // Post-process: Remove empty children arrays and sort
    const processNodes = (nodes: MenuItem[]) => {
      nodes.sort((a, b) => {
        const wbsA = (a as any).wbs_code;
        const wbsB = (b as any).wbs_code;
        return wbsA.localeCompare(wbsB, undefined, { numeric: true });
      });

      nodes.forEach((n) => {
        if (n.children && n.children.length === 0) {
          delete n.children;
        } else if (n.children) {
          processNodes(n.children);
        }
        // Remove internal tracking fields before returning
        delete (n as any).id;
        delete (n as any).wbs_code;
        delete (n as any).parent_id;
      });
    };

    processNodes(roots);

    return roots;
  }
}
