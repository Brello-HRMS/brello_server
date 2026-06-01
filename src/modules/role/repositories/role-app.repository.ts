import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RoleApp } from '../entities/role-app.entity';

@Injectable()
export class RoleAppRepository {
  constructor(
    @InjectRepository(RoleApp)
    private readonly repository: Repository<RoleApp>,
  ) {}

  async findByRoleId(roleId: string): Promise<RoleApp[]> {
    return this.repository.find({
      where: { role_id: roleId },
      relations: ['app'],
    });
  }

  async syncAppsForRole(roleId: string, appIds: string[]): Promise<void> {
    const existing = await this.repository.find({ where: { role_id: roleId } });
    const existingAppIds = new Set(existing.map((ra) => ra.app_id));
    const desiredAppIds = new Set(appIds);

    const toDelete = existing.filter((ra) => !desiredAppIds.has(ra.app_id));
    const toCreate = appIds.filter((id) => !existingAppIds.has(id));

    if (toDelete.length > 0) {
      await this.repository.delete(toDelete.map((ra) => ra.id));
    }

    if (toCreate.length > 0) {
      const newEntries = toCreate.map((appId) =>
        this.repository.create({ role_id: roleId, app_id: appId }),
      );
      await this.repository.save(newEntries);
    }
  }

  async deleteByRoleId(roleId: string): Promise<void> {
    await this.repository.delete({ role_id: roleId });
  }
}
