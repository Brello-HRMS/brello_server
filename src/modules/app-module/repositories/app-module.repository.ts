import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { AppModule } from '../entities/app-module.entity';

export interface ModuleReorderUpdate {
  id: string;
  parent_id: string | null;
  wbs_code: string;
  type: AppModule['type'];
}

@Injectable()
export class AppModuleRepository {
  constructor(
    @InjectRepository(AppModule)
    private readonly repository: Repository<AppModule>,
    private readonly dataSource: DataSource,
  ) {}

  create(data: Partial<AppModule>): AppModule {
    return this.repository.create(data);
  }

  async save(module: AppModule): Promise<AppModule> {
    return this.repository.save(module);
  }

  async findAll(): Promise<AppModule[]> {
    return this.repository.find({
      order: {
        app_id: 'ASC',
        wbs_code: 'ASC',
      },
    });
  }

  async findByAppId(appId: string): Promise<AppModule[]> {
    return this.repository.find({
      where: { app_id: appId, status: 'ACTIVE' as any },
      order: { wbs_code: 'ASC' },
    });
  }

  async findByAppIds(appIds: string[]): Promise<AppModule[]> {
    if (!appIds.length) return [];
    return this.repository.find({
      where: { app_id: In(appIds), status: 'ACTIVE' as any },
      order: { wbs_code: 'ASC' },
    });
  }

  async findOneById(id: string): Promise<AppModule | null> {
    return this.repository.findOne({ where: { id } });
  }

  async findByIds(ids: string[]): Promise<AppModule[]> {
    if (!ids.length) return [];
    return this.repository.find({ where: { id: In(ids) } });
  }

  async findChildren(parentId: string): Promise<AppModule[]> {
    return this.repository.find({
      where: { parent_id: parentId, status: 'ACTIVE' as any },
    });
  }

  /** Applies a batch of parent/wbs/type moves atomically — used by drag-and-drop reordering. */
  async bulkMove(updates: ModuleReorderUpdate[]): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      for (const u of updates) {
        await manager.update(AppModule, u.id, {
          parent_id: u.parent_id,
          wbs_code: u.wbs_code,
          type: u.type,
        });
      }
    });
  }

  async findByCodeAndApp(
    code: string,
    app_id: string,
  ): Promise<AppModule | null> {
    return this.repository.findOne({
      where: { code: code.toUpperCase(), app_id, status: 'ACTIVE' as any },
    });
  }

  async softDelete(id: string): Promise<boolean> {
    const result = await this.repository.update(id, {
      status: 'DELETED' as any,
    });
    return (result.affected ?? 0) > 0;
  }
}
