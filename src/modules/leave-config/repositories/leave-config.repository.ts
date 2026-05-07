import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager } from 'typeorm';
import { LeaveConfig } from '../entities/leave-config.entity';
import { LeaveType } from '../entities/leave-type.entity';
import { LeaveRules } from '../entities/leave-rules.entity';

@Injectable()
export class LeaveConfigRepository {
  constructor(
    @InjectRepository(LeaveConfig)
    private readonly repository: Repository<LeaveConfig>,
    private readonly dataSource: DataSource,
  ) {}

  async create(data: Partial<LeaveConfig>): Promise<LeaveConfig> {
    const config = this.repository.create(data);
    return this.repository.save(config);
  }

  async findOneWithRelations(id: string, organizationId: string): Promise<LeaveConfig | null> {
    return this.repository.findOne({
      where: { id, organization_id: organizationId },
      relations: ['leave_types', 'rules'],
    });
  }

  async findCurrent(organizationId: string): Promise<LeaveConfig | null> {
    return this.repository.findOne({
      where: { organization_id: organizationId },
      order: { created_at: 'DESC' },
      relations: ['leave_types', 'rules'],
    });
  }

  async save(config: LeaveConfig): Promise<LeaveConfig> {
    return this.repository.save(config);
  }

  async update(id: string, data: Partial<LeaveConfig>): Promise<void> {
    await this.repository.update(id, data);
  }

  /**
   * Transactional update for LeaveConfig, LeaveTypes (REPLACE), and LeaveRules
   */
  async updateWithRelations(
    id: string,
    configData: Partial<LeaveConfig>,
    leaveTypesData?: Partial<LeaveType>[],
    rulesData?: Partial<LeaveRules>,
  ): Promise<LeaveConfig | null> {
    return this.dataSource.transaction(async (manager: EntityManager) => {
      // 1. Update LeaveConfig
      if (Object.keys(configData).length > 0) {
        await manager.update(LeaveConfig, id, configData);
      }

      // 2. Replace LeaveTypes if provided
      if (leaveTypesData) {
        // Delete existing
        await manager.delete(LeaveType, { config_id: id });
        // Insert new
        if (leaveTypesData.length > 0) {
          const newTypes = leaveTypesData.map((type) =>
            manager.create(LeaveType, { ...type, config_id: id }),
          );
          await manager.save(LeaveType, newTypes);
        }
      }

      // 3. Upsert LeaveRules if provided
      if (rulesData) {
        const existingRules = await manager.findOne(LeaveRules, { where: { config_id: id } });
        if (existingRules) {
          await manager.update(LeaveRules, { config_id: id }, rulesData);
        } else {
          const newRules = manager.create(LeaveRules, { ...rulesData, config_id: id });
          await manager.save(LeaveRules, newRules);
        }
      }

      return manager.findOne(LeaveConfig, {
        where: { id },
        relations: ['leave_types', 'rules'],
      });
    });
  }
}
