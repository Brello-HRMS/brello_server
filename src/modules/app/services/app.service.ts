import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { App } from '../entities/app.entity';
import { CreateAppDto } from '../dto/create-app.dto';
import { UpdateAppDto } from '../dto/update-app.dto';
import { AppRepository } from '../repositories/app.repository';
import { EnterpriseAppRepository } from '../../enterprise/repositories/enterprise-app.repository';

@Injectable()
export class AppService {
  constructor(
    private readonly appRepository: AppRepository,
    private readonly enterpriseAppRepository: EnterpriseAppRepository,
  ) {}

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

  async findAllForEnterprise(enterpriseId: string): Promise<App[]> {
    const enterpriseApps =
      await this.enterpriseAppRepository.getAppsForEnterprise(enterpriseId);

    if (!enterpriseApps.length) {
      return [];
    }

    const appIds = enterpriseApps.map((ea) => ea.app_id);
    return this.appRepository.findByIds(appIds);
  }

  async findOne(id: string): Promise<App> {
    return this.appRepository.findOneById(id);
  }

  async findOneForEnterprise(id: string, enterpriseId: string): Promise<App> {
    const apps = await this.findAllForEnterprise(enterpriseId);
    const app = apps.find((a) => a.id === id);
    if (!app) {
      throw new NotFoundException(
        `App with ID "${id}" not found or not assigned to your enterprise`,
      );
    }
    return app;
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
