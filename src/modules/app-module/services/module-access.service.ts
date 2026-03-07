import { Injectable, ConflictException } from '@nestjs/common';
import { ModuleAccess } from '../entities/module-access.entity';
import { ModuleAccessRepository } from '../repositories/module-access.repository';
import {
  CreateModuleAccessDto,
  UpdateModuleAccessDto,
} from '../dto/module-access.dto';

@Injectable()
export class ModuleAccessService {
  constructor(
    private readonly moduleAccessRepository: ModuleAccessRepository,
  ) {}

  async create(dto: CreateModuleAccessDto): Promise<ModuleAccess> {
    const moduleAccess = this.moduleAccessRepository.create(dto);
    try {
      return await this.moduleAccessRepository.save(moduleAccess);
    } catch (error) {
      throw new ConflictException(
        'This role already has a configuration for this action on this module.',
      );
    }
  }

  async findAll(): Promise<ModuleAccess[]> {
    return this.moduleAccessRepository.findAll();
  }

  async findOne(id: string): Promise<ModuleAccess> {
    return this.moduleAccessRepository.findOneById(id);
  }

  async findByRole(roleId: string): Promise<ModuleAccess[]> {
    return this.moduleAccessRepository.findByRole(roleId);
  }

  async update(id: string, dto: UpdateModuleAccessDto): Promise<ModuleAccess> {
    const moduleAccess = await this.findOne(id);
    Object.assign(moduleAccess, dto);
    return this.moduleAccessRepository.save(moduleAccess);
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.moduleAccessRepository.delete(id);
  }
}
