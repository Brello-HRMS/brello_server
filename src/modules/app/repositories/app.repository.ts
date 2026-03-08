import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { App } from '../entities/app.entity';
import { Status } from '../../../common/enums';

@Injectable()
export class AppRepository {
  constructor(
    @InjectRepository(App)
    private readonly repository: Repository<App>,
  ) {}

  create(data: Partial<App>): App {
    return this.repository.create(data);
  }

  async save(app: App): Promise<App> {
    return this.repository.save(app);
  }

  async findAll(): Promise<App[]> {
    return this.repository.find({
      order: { priority: 'ASC' },
    });
  }

  async findByIds(ids: string[]): Promise<App[]> {
    if (!ids || ids.length === 0) return [];

    return this.repository.find({
      where: {
        id: In(ids),
      },
      order: { priority: 'ASC' },
    });
  }

  async findOneById(id: string): Promise<App | null> {
    return this.repository.findOne({
      where: { id },
    });
  }

  async findByName(name: string): Promise<App | null> {
    return this.repository.findOne({ where: { name } });
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.repository.update(id, {
      status: Status.DELETED,
    });
    return (result.affected ?? 0) > 0;
  }
}
