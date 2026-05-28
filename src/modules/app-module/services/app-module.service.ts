import {
  Injectable,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { AppModule } from '../entities/app-module.entity';
import { AppModuleRepository } from '../repositories/app-module.repository';
import { CreateAppModuleDto, UpdateAppModuleDto } from '../dto/app-module.dto';
import { LoggedInUser } from '../../auth/interfaces/logged-in-user.interface';

@Injectable()
export class AppModuleService {
  private readonly logger = new Logger(AppModuleService.name);
 
  constructor(private readonly appModuleRepository: AppModuleRepository) {}

  async create(dto: CreateAppModuleDto, user?: LoggedInUser): Promise<AppModule> {
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

  async update(id: string, dto: UpdateAppModuleDto, user?: LoggedInUser): Promise<AppModule> {
    const module = await this.findOne(id, user);
    Object.assign(module, dto);
    return this.appModuleRepository.save(module);
  }

  async remove(id: string, user?: LoggedInUser): Promise<void> {
    await this.findOne(id, user);
    await this.appModuleRepository.softDelete(id);
  }
}
