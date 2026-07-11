import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { AppModule, ModuleType } from '../entities/app-module.entity';
import { AppModuleRepository } from '../repositories/app-module.repository';
import {
  CreateAppModuleDto,
  UpdateAppModuleDto,
  ReorderAppModulesDto,
} from '../dto/app-module.dto';
import { LoggedInUser } from '../../auth/interfaces/logged-in-user.interface';

@Injectable()
export class AppModuleService {
  private readonly logger = new Logger(AppModuleService.name);

  constructor(private readonly appModuleRepository: AppModuleRepository) {}

  async create(
    dto: CreateAppModuleDto,
    user?: LoggedInUser,
  ): Promise<AppModule> {
    this.logger.log(`Creating app module: ${dto.code}`);
    const module = this.appModuleRepository.create(dto);
    try {
      return await this.appModuleRepository.save(module);
    } catch (error: any) {
      if (error.code === '23505') {
        throw new ConflictException('Module code already exists for this app');
      }
      throw error;
    }
  }

  async findAll(user?: LoggedInUser, appId?: string): Promise<AppModule[]> {
    if (appId) return this.appModuleRepository.findByAppId(appId);
    return this.appModuleRepository.findAll();
  }

  async findOne(id: string, user?: LoggedInUser): Promise<AppModule> {
    const module = await this.appModuleRepository.findOneById(id);
    if (!module) {
      throw new NotFoundException(`AppModule with ID "${id}" not found`);
    }
    return module;
  }

  async update(
    id: string,
    dto: UpdateAppModuleDto,
    user?: LoggedInUser,
  ): Promise<AppModule> {
    const module = await this.findOne(id, user);
    Object.assign(module, dto);
    return this.appModuleRepository.save(module);
  }

  async remove(id: string, user?: LoggedInUser): Promise<void> {
    await this.findOne(id, user);
    await this.appModuleRepository.softDelete(id);
  }

  /**
   * Applies a batch of moves from drag-and-drop reordering: reordering siblings,
   * promoting a sub-module to a top-level module, or demoting a module into a
   * sub-module of another. Validated and applied atomically.
   */
  async reorder(dto: ReorderAppModulesDto, user?: LoggedInUser): Promise<void> {
    const ids = dto.updates.map((u) => u.id);
    const current = await this.appModuleRepository.findByIds(ids);
    const currentById = new Map(current.map((m) => [m.id, m]));

    if (current.length !== ids.length) {
      throw new NotFoundException(
        'One or more modules in the reorder request were not found',
      );
    }

    const appId = current[0].app_id;
    if (current.some((m) => m.app_id !== appId)) {
      throw new BadRequestException(
        'All modules in a single reorder must belong to the same app',
      );
    }

    const parentIds = new Set(
      dto.updates.filter((u) => u.parent_id).map((u) => u.parent_id as string),
    );
    const parents =
      parentIds.size > 0
        ? await this.appModuleRepository.findByIds([...parentIds])
        : [];
    const parentsById = new Map(parents.map((m) => [m.id, m]));

    for (const update of dto.updates) {
      if (update.type === ModuleType.MOD && update.parent_id) {
        throw new BadRequestException(
          `"${currentById.get(update.id)?.name ?? update.id}" is a top-level module and cannot have a parent`,
        );
      }

      if (update.type === ModuleType.SUBMOD) {
        if (!update.parent_id) {
          throw new BadRequestException(
            `"${currentById.get(update.id)?.name ?? update.id}" must have a parent to become a sub-module`,
          );
        }
        const parent = parentsById.get(update.parent_id);
        if (!parent || parent.app_id !== appId) {
          throw new BadRequestException(
            'Target parent module not found for this app',
          );
        }
        if (parent.type !== ModuleType.MOD) {
          throw new BadRequestException(
            'A sub-module cannot be nested under another sub-module',
          );
        }
      }

      // Demoting a module (MOD → SUBMOD) is only allowed once it has no children left —
      // otherwise its children would be orphaned under a non-top-level parent.
      const existing = currentById.get(update.id)!;
      if (
        existing.type === ModuleType.MOD &&
        update.type === ModuleType.SUBMOD
      ) {
        const children = await this.appModuleRepository.findChildren(update.id);
        const stillChildren = children.filter(
          (c) =>
            !dto.updates.some(
              (u) => u.id === c.id && u.parent_id !== update.id,
            ),
        );
        if (stillChildren.length > 0) {
          throw new ConflictException(
            `Move "${existing.name}"'s sub-modules out first before making it a sub-module itself`,
          );
        }
      }
    }

    await this.appModuleRepository.bulkMove(
      dto.updates.map((u) => ({
        id: u.id,
        parent_id: u.parent_id ?? null,
        wbs_code: u.wbs_code,
        type: u.type,
      })),
    );

    await this.cascadeChildrenWbs(dto.updates, currentById);
  }

  /**
   * Defense-in-depth backstop: whenever a top-level module's own wbs_code
   * changes in this batch, re-stamp its children's wbs_code with the new
   * prefix too — a child's wbs encodes its parent's wbs (e.g. "9.1" under
   * root "9"), so an un-cascaded parent move leaves children pointing at a
   * stale prefix. The webapp already computes this cascade client-side;
   * this re-derives it server-side from current DB state so a bug or a
   * non-webapp caller can't leave the tree inconsistent.
   */
  private async cascadeChildrenWbs(
    updates: ReorderAppModulesDto['updates'],
    currentById: Map<string, AppModule>,
  ): Promise<void> {
    const changedRoots = updates.filter((u) => {
      if (u.type !== ModuleType.MOD) return false;
      const before = currentById.get(u.id);
      return before && before.wbs_code !== u.wbs_code;
    });

    for (const root of changedRoots) {
      const children = (
        await this.appModuleRepository.findChildren(root.id)
      ).sort((a, b) => this.wbsSuffix(a.wbs_code) - this.wbsSuffix(b.wbs_code));
      if (children.length === 0) continue;

      await this.appModuleRepository.bulkMove(
        children.map((c, idx) => ({
          id: c.id,
          parent_id: root.id,
          wbs_code: `${root.wbs_code}.${idx + 1}`,
          type: ModuleType.SUBMOD,
        })),
      );
    }
  }

  private wbsSuffix(wbs: string): number {
    const parts = wbs.split('.');
    return parseInt(parts[parts.length - 1], 10) || 0;
  }
}
