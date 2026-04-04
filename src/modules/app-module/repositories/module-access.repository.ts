import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ModuleAccess } from '../entities/module-access.entity';

@Injectable()
export class ModuleAccessRepository {
  constructor(
    @InjectRepository(ModuleAccess)
    private readonly repository: Repository<ModuleAccess>,
  ) {}

  create(data: Partial<ModuleAccess>): ModuleAccess {
    return this.repository.create(data);
  }

  async save(moduleAccess: ModuleAccess): Promise<ModuleAccess> {
    return this.repository.save(moduleAccess);
  }

  async findAll(): Promise<ModuleAccess[]> {
    return this.repository.find({
      relations: ['role', 'module', 'action'],
      order: { created_at: 'DESC' },
    });
  }

  async findOneById(id: string): Promise<ModuleAccess> {
    const moduleAccess = await this.repository.findOne({
      where: { id },
      relations: ['role', 'module', 'action'],
    });
    if (!moduleAccess) {
      throw new NotFoundException(`ModuleAccess with ID "${id}" not found`);
    }
    return moduleAccess;
  }


  async findOne(options: any): Promise<ModuleAccess | null> {
    return this.repository.findOne(options);
  }

  async findByRole(roleId: string): Promise<ModuleAccess[]> {
    return this.repository.find({
      where: { role_id: roleId },
      relations: ['module', 'action'],
    });
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.repository.delete(id);
    return (result.affected ?? 0) > 0;
  }
}
