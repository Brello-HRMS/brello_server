import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import * as dns from 'dns';
import { DataSource } from 'typeorm';
import { Enterprise } from '../entities/enterprise.entity';
import { App } from '../../app/entities/app.entity';
import { CreateEnterpriseDto } from '../dto/create-enterprise.dto';
import { UpdateEnterpriseDto } from '../dto/update-enterprise.dto';
import { EnterpriseRepository } from '../repositories/enterprise.repository';
import { EnterpriseAppRepository } from '../repositories/enterprise-app.repository';
import { AppRepository } from '../../app/repositories/app.repository';

@Injectable()
export class EnterpriseService {
  constructor(
    private readonly enterpriseRepository: EnterpriseRepository,
    private readonly enterpriseAppRepository: EnterpriseAppRepository,
    @Inject(forwardRef(() => AppRepository))
    private readonly appRepository: AppRepository,
    private readonly dataSource: DataSource,
  ) {}

  async create(dto: CreateEnterpriseDto): Promise<Enterprise> {
    await this.validateDomainExists(dto.domain);
    await this.validateDomainUniqueness(dto.domain);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const enterprise = this.enterpriseRepository.create(dto);
      const savedEnterprise = await queryRunner.manager.save(enterprise);

      const allApps = await this.appRepository.findAll();
      if (allApps.length > 0) {
        const appIds = allApps.map((app) => app.id);
        await this.createAppMappings(
          savedEnterprise.id,
          appIds,
          queryRunner.manager,
        );
      }

      await queryRunner.commitTransaction();
      return savedEnterprise;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(): Promise<(Enterprise & { apps: App[] })[]> {
    const enterprises = await this.enterpriseRepository.findAll();
    if (!enterprises.length) return [];

    const enterpriseIds = enterprises.map((e) => e.id);

    const appEnterpriseMappings =
      await this.enterpriseAppRepository.getAppsForEnterpriseIds(enterpriseIds);

    const uniqueAppIds = [
      ...new Set(appEnterpriseMappings.map((app) => app.app_id)),
    ];
    const allApps =
      uniqueAppIds.length > 0
        ? await this.appRepository.findByIds(uniqueAppIds)
        : [];

    const appMap = new Map(allApps.map((app) => [app.id, app]));

    return enterprises.map((enterprise) => {
      const enterpriseAppIds = appEnterpriseMappings
        .filter((app) => app.enterprise_id === enterprise.id)
        .map((app) => app.app_id);

      const apps = enterpriseAppIds
        .map((id) => appMap.get(id))
        .filter((app): app is App => !!app);

      return { ...enterprise, apps };
    });
  }

  async findOneById(id: string): Promise<Enterprise & { apps: App[] }> {
    const enterprise = await this.enterpriseRepository.findOneById(id);
    if (!enterprise) {
      throw new NotFoundException(`Enterprise with ID "${id}" not found`);
    }

    const apps = await this.getAppsForEnterprise(id);
    return { ...enterprise, apps };
  }

  private async getAppsForEnterprise(enterpriseId: string): Promise<App[]> {
    const mappings =
      await this.enterpriseAppRepository.getAppsForEnterprise(enterpriseId);

    if (!mappings.length) return [];

    const appIds = mappings.map((mapping) => mapping.app_id);
    return this.appRepository.findByIds(appIds);
  }

  async update(id: string, dto: UpdateEnterpriseDto): Promise<Enterprise> {
    const enterprise = await this.findOneById(id);

    if (dto.domain && dto.domain !== enterprise.domain) {
      await this.validateDomainUniqueness(dto.domain);
    }

    Object.assign(enterprise, dto);
    return this.enterpriseRepository.save(enterprise);
  }

  async remove(id: string): Promise<void> {
    await this.findOneById(id);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await this.enterpriseAppRepository.softDeleteByEnterpriseId(id);
      await this.enterpriseRepository.softDelete(id);

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async assignAppsToEnterprise(
    enterpriseId: string,
    appIds: string[],
  ): Promise<void> {
    await this.findOneById(enterpriseId);
    await this.enterpriseAppRepository.bulkCreate(enterpriseId, appIds);
  }

  private async validateDomainExists(domain: string): Promise<void> {
    try {
      await dns.promises.resolve(domain);
    } catch {
      throw new BadRequestException(
        `Domain "${domain}" does not exist. Please provide a valid domain.`,
      );
    }
  }

  private async validateDomainUniqueness(domain: string): Promise<void> {
    const existing = await this.enterpriseRepository.findByDomain(domain);
    if (existing) {
      throw new ConflictException(
        `Enterprise with domain "${domain}" already exists`,
      );
    }
  }

  private async createAppMappings(
    enterpriseId: string,
    appIds: string[],
    manager: any,
  ): Promise<void> {
    const mappings = appIds.map((appId) => ({
      enterprise_id: enterpriseId,
      app_id: appId,
    }));
    await manager
      .createQueryBuilder()
      .insert()
      .into('enterprise_app')
      .values(mappings)
      .execute();
  }
}
