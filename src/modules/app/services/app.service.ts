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
import { LoggedInUser } from '../../auth/interfaces/logged-in-user.interface';

@Injectable()
export class AppService {
  constructor(
    private readonly appRepository: AppRepository,
    private readonly enterpriseAppRepository: EnterpriseAppRepository,
  ) {}

  async create(user: LoggedInUser, dto: CreateAppDto): Promise<App> {
    const existing = await this.appRepository.findByName(dto.name);
    if (existing) {
      throw new ConflictException(`App with name "${dto.name}" already exists`);
    }
    const app = this.appRepository.create(dto);
    return this.appRepository.save(app);
  }

  async findAll(user: LoggedInUser): Promise<App[]> {
    return this.appRepository.findAll();
  }

  async findAllForEnterprise(enterpriseId: string, user: LoggedInUser): Promise<App[]> {
    const enterpriseApps =
      await this.enterpriseAppRepository.getAppsForEnterprise(enterpriseId);

    if (!enterpriseApps.length) {
      return [];
    }

    const appIds = enterpriseApps.map((ea) => ea.app_id);
    return this.appRepository.findByIds(appIds);
  }

  async findOne(id: string, user: LoggedInUser): Promise<App> {
    const app = await this.appRepository.findOneById(id);
    if (!app) {
      throw new NotFoundException(`App with ID "${id}" not found`);
    }
    return app;
  }

  async findOneForEnterprise(id: string, enterpriseId: string, user: LoggedInUser): Promise<App> {
    const apps = await this.findAllForEnterprise(enterpriseId, user);
    const app = apps.find((a) => a.id === id);
    if (!app) {
      throw new NotFoundException(
        `App with ID "${id}" not found or not assigned to your enterprise`,
      );
    }
    return app;
  }

  async findAllForUser(user: LoggedInUser): Promise<App[]> {
    if (user.isPlatformAdmin) {
      return this.findAll(user);
    }
    return this.findAllForEnterprise(user.enterpriseId, user);
  }

  async findOneForUser(id: string, user: LoggedInUser): Promise<App> {
    if (user.isPlatformAdmin) {
      return this.findOne(id, user);
    }
    return this.findOneForEnterprise(id, user.enterpriseId, user);
  }

  async update(id: string, user: LoggedInUser, dto: UpdateAppDto): Promise<App> {
    const app = await this.findOne(id, user);
    Object.assign(app, dto);
    return this.appRepository.save(app);
  }

  async remove(id: string, user: LoggedInUser): Promise<void> {
    await this.findOne(id, user);
    await this.appRepository.delete(id);
  }
}
