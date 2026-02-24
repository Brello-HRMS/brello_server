import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { App } from '../entities/app.entity';
import { CreateAppDto } from '../dto/create-app.dto';
import { UpdateAppDto } from '../dto/update-app.dto';

@Injectable()
export class AppService {
    constructor(
        @InjectRepository(App)
        private readonly appRepository: Repository<App>,
    ) { }

    async create(dto: CreateAppDto): Promise<App> {
        const existing = await this.appRepository.findOne({ where: { name: dto.name } });
        if (existing) {
            throw new ConflictException(`App with name "${dto.name}" already exists`);
        }
        const app = this.appRepository.create(dto);
        return this.appRepository.save(app);
    }

    async findAll(): Promise<App[]> {
        return this.appRepository.find({ order: { priority: 'ASC' } });
    }

    async findOne(id: string): Promise<App> {
        const app = await this.appRepository.findOne({ where: { id } });
        if (!app) {
            throw new NotFoundException(`App with ID "${id}" not found`);
        }
        return app;
    }

    async update(id: string, dto: UpdateAppDto): Promise<App> {
        const app = await this.findOne(id);
        Object.assign(app, dto);
        return this.appRepository.save(app);
    }

    async remove(id: string): Promise<void> {
        const app = await this.findOne(id);
        await this.appRepository.remove(app);
    }
}
