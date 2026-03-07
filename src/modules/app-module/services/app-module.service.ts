import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
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
    } catch (error: any) {
      if (error.code === '23505') {
        throw new ConflictException('Module code already exists for this app');
      }
      throw error;
    }
  }

  async findAll(): Promise<AppModule[]> {
    return this.appModuleRepository.findAll();
  }

  async findOne(id: string): Promise<AppModule> {
    const module = await this.appModuleRepository.findOneById(id);
    if (!module) {
      throw new NotFoundException(`AppModule with ID "${id}" not found`);
    }
    return module;
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
