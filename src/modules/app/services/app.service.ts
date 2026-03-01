import { Injectable, ConflictException } from '@nestjs/common';
import { App } from '../entities/app.entity';
import { CreateAppDto } from '../dto/create-app.dto';
import { UpdateAppDto } from '../dto/update-app.dto';
import { AppRepository } from '../repositories/app.repository';

@Injectable()
export class AppService {
  constructor(private readonly appRepository: AppRepository) {}

  async create(dto: CreateAppDto): Promise<App> {
    const existing = await this.appRepository.findByName(dto.name);
    if (existing) {
      throw new ConflictException(`App with name "${dto.name}" already exists`);
    }
    const app = this.appRepository.create(dto);
    return this.appRepository.save(app);
  }

  async findAll(): Promise<App[]> {
    return this.appRepository.findAll();
  }

  async findOne(id: string): Promise<App> {
    return this.appRepository.findOneById(id);
  }

  async update(id: string, dto: UpdateAppDto): Promise<App> {
    const app = await this.findOne(id);
    Object.assign(app, dto);
    return this.appRepository.save(app);
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.appRepository.delete(id);
  }
}
