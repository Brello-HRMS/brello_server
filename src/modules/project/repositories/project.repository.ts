import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Project } from '../entities/project.entity';
import { ProjectTeam } from '../entities/project-team.entity';
import { ProjectContract } from '../entities/project-contract.entity';
import { Status } from 'src/common/enums';

@Injectable()
export class ProjectRepository {
  constructor(
    @InjectRepository(Project)
    private readonly repository: Repository<Project>,
    @InjectRepository(ProjectTeam)
    private readonly teamRepository: Repository<ProjectTeam>,
    @InjectRepository(ProjectContract)
    private readonly contractRepository: Repository<ProjectContract>,
  ) {}

  getQueryBuilder(alias: string = 'project'): SelectQueryBuilder<Project> {
    return this.repository.createQueryBuilder(alias);
  }

  async create(data: Partial<Project>): Promise<Project> {
    const project = this.repository.create(data);
    return this.repository.save(project);
  }

  async findById(id: string): Promise<Project | null> {
    return this.repository.findOne({
      where: { id },
      relations: ['client', 'contracts', 'team'],
    });
  }

  async findOne(options: any): Promise<Project | null> {
    return this.repository.findOne(options);
  }

  async update(id: string, data: Partial<Project>): Promise<Project | null> {
    await this.repository.update(id, data);
    return this.findById(id);
  }

  async softDelete(id: string, userId: string): Promise<void> {
    await this.repository.update(id, {
      deleted_at: new Date(),
      updated_by: userId,
      status: Status.DELETED,
    } as any);
  }

  // Team Management
  async replaceTeam(
    projectId: string,
    members: { user_id: string; role: string }[],
    assignedBy: string,
  ): Promise<void> {
    // Delete existing team mappings
    await this.teamRepository.delete({ project_id: projectId });

    // Insert new mappings
    if (members.length > 0) {
      const mappings = members.map((member) =>
        this.teamRepository.create({
          project_id: projectId,
          user_id: member.user_id,
          role: member.role,
          assigned_by: assignedBy,
        }),
      );
      await this.teamRepository.save(mappings);
    }
  }

  // Contract Management
  async addContract(data: Partial<ProjectContract>): Promise<ProjectContract> {
    const contract = this.contractRepository.create(data);
    return this.contractRepository.save(contract);
  }
}
