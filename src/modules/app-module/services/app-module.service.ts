import { Injectable, ConflictException } from '@nestjs/common';
import { AppModule } from '../entities/app-module.entity';
import { AppModuleRepository } from '../repositories/app-module.repository';
import { CreateAppModuleDto, UpdateAppModuleDto } from '../dto/app-module.dto';

@Injectable()
export class AppModuleService {
  constructor(private readonly appModuleRepository: AppModuleRepository) {}

  async create(dto: CreateAppModuleDto): Promise<AppModule> {
    const module = this.appModuleRepository.create(dto);
    try {
      return await this.appModuleRepository.save(module);
    } catch (error) {
      // Primitive way to catch unique constraint violations on app_id/code
      throw new ConflictException('Module code already exists for this app');
    }
  }

  async findAll(): Promise<AppModule[]> {
    return this.appModuleRepository.findAll();
  }

  async findOne(id: string): Promise<AppModule> {
    return this.appModuleRepository.findOneById(id);
  }

  async update(id: string, dto: UpdateAppModuleDto): Promise<AppModule> {
    const module = await this.findOne(id);
    Object.assign(module, dto);
    return this.appModuleRepository.save(module);
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.appModuleRepository.softDelete(id);
  }
}
