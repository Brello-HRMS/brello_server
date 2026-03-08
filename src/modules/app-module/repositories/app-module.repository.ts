import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppModule } from '../entities/app-module.entity';

@Injectable()
export class AppModuleRepository {
  constructor(
    @InjectRepository(AppModule)
    private readonly repository: Repository<AppModule>,
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

  async findOneById(id: string): Promise<AppModule | null> {
    return this.repository.findOne({ where: { id } });
  }

  async softDelete(id: string): Promise<boolean> {
    const result = await this.repository.update(id, {
      status: 'DELETED' as any,
    });
    return (result.affected ?? 0) > 0;
  }
}
