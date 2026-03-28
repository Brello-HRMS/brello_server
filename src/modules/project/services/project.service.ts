import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { DeepPartial } from 'typeorm';
import { ProjectRepository } from '../repositories/project.repository';
import { ClientService } from '../../client/services/client.service';
import { CreateProjectDto } from '../dto/create-project.dto';
import { UpdateProjectDto } from '../dto/update-project.dto';
import { ListProjectsDto } from '../dto/list-projects.dto';
import { AssignTeamDto } from '../dto/assign-team.dto';
import { Project } from '../entities/project.entity';
import { ListingHelper } from '../../../common/utils/listing.helper';
import { LoggedInUser } from '../../auth/interfaces/logged-in-user.interface';
import { PaginatedResponse } from '../../../common/dto/pagination.dto';
import { DocumentService } from '../../document/services/document.service';
import { FolderType } from '../../document/enums/document.enum';
import { ProjectContract } from '../entities/project-contract.entity';

export interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@Injectable()
export class ProjectService {
  private readonly logger = new Logger(ProjectService.name);

  constructor(
    private readonly projectRepository: ProjectRepository,
    private readonly clientService: ClientService,
    private readonly documentService: DocumentService,
  ) {}

  async create(
    clientId: string,
    dto: CreateProjectDto,
    user: LoggedInUser,
  ): Promise<Project> {
    this.logger.log(`Creating project: ${dto.name} for client: ${clientId}`);

    // 1. Validate Client exists and belongs to same org
    const client = await this.clientService.findOne(clientId);
    if (client.organization_id !== user.organizationId) {
      throw new NotFoundException(
        `Client with ID "${clientId}" not found in your organization`,
      );
    }

    // 2. Validate Uniqueness (client_id, name)
    const existingProject = await this.projectRepository.findOne({
      where: { client_id: clientId, name: dto.name },
    });
    if (existingProject) {
      throw new ConflictException(
        `Project with name "${dto.name}" already exists for this client`,
      );
    }

    // 3. Validate Dates
    if (
      dto.start_date &&
      dto.end_date &&
      new Date(dto.end_date) < new Date(dto.start_date)
    ) {
      throw new BadRequestException(
        'End date must be greater than or equal to start date',
      );
    }

    const projectData = {
      ...dto,
      client_id: clientId,
      organization_id: user.organizationId,
      enterprise_id: user.enterpriseId,
      created_by: user.userId,
    };

    return this.projectRepository.create(projectData as DeepPartial<Project>);
  }

  async findAllByClient(
    clientId: string,
    query: ListProjectsDto,
    user: LoggedInUser,
  ): Promise<PaginatedResponse<Project>> {
    this.logger.log(`Fetching projects for client: ${clientId}`);

    // Ensure client belongs to org
    const client = await this.clientService.findOne(clientId);
    if (client.organization_id !== user.organizationId) {
      throw new NotFoundException(
        `Client with ID "${clientId}" not found in your organization`,
      );
    }

    const queryBuilder = this.projectRepository
      .getQueryBuilder('project')
      .where('project.client_id = :clientId', { clientId });

    return ListingHelper.apply(queryBuilder, query, user, {
      searchFields: ['name', 'description'],
      filterFields: ['status', 'priority'],
      alias: 'project',
    });
  }

  async findAll(
    query: ListProjectsDto,
    user: LoggedInUser,
  ): Promise<PaginatedResponse<Project>> {
    this.logger.log(
      `Fetching all projects for organization: ${user.organizationId}`,
    );

    const queryBuilder = this.projectRepository
      .getQueryBuilder('project')
      .leftJoinAndSelect('project.client', 'client');

    // Default sort by client name if not provided
    if (!query.sort_by) {
      query.sort_by = 'client.name';
      query.sort_order = 'ASC';
    }

    return ListingHelper.apply(queryBuilder, query, user, {
      searchFields: ['name', 'description', 'client.name'],
      filterFields: ['project_status', 'priority', 'client_id'],
      alias: 'project',
    });
  }

  async findOne(id: string, user: LoggedInUser): Promise<Project> {
    this.logger.log(`Fetching project: ${id}`);

    const project = await this.projectRepository.findById(id);

    if (!project || project.organization_id !== user.organizationId) {
      throw new NotFoundException(`Project with ID "${id}" not found`);
    }

    return project;
  }

  async update(
    id: string,
    dto: UpdateProjectDto,
    user: LoggedInUser,
  ): Promise<Project> {
    this.logger.log(`Updating project: ${id}`);

    const project = await this.findOne(id, user);

    // 1. Validate Uniqueness if name is changing
    if (dto.name && dto.name !== project.name) {
      const existingProject = await this.projectRepository.findOne({
        where: { client_id: project.client_id, name: dto.name },
      });
      if (existingProject) {
        throw new ConflictException(
          `Project with name "${dto.name}" already exists for this client`,
        );
      }
    }

    // 2. Validate Dates
    const startDate = dto.start_date || project.start_date;
    const endDate = dto.end_date || project.end_date;
    if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
      throw new BadRequestException(
        'End date must be greater than or equal to start date',
      );
    }

    const updatedProject = await this.projectRepository.update(id, {
      ...dto,
      modified_by: user.userId,
      modified_at: new Date(),
    } as DeepPartial<Project>);

    if (!updatedProject) {
      throw new NotFoundException(
        `Project with ID "${id}" not found after update`,
      );
    }

    return updatedProject;
  }

  async remove(id: string, user: LoggedInUser): Promise<void> {
    this.logger.log(`Deleting project: ${id}`);

    await this.findOne(id, user);

    await this.projectRepository.softDelete(id);
  }

  async assignTeam(
    id: string,
    dto: AssignTeamDto,
    user: LoggedInUser,
  ): Promise<void> {
    this.logger.log(`Assigning team to project: ${id}`);

    await this.findOne(id, user);

    const leadCount = dto.members.filter((m) => m.is_lead).length;
    if (leadCount > 1) {
      throw new BadRequestException('A project can have at most one team lead');
    }

    // V1: Replace existing team mapping
    await this.projectRepository.replaceTeam(id, dto.members, user.userId);
  }

  async uploadContract(
    id: string,
    file: MulterFile,
    user: LoggedInUser,
  ): Promise<ProjectContract> {
    this.logger.log(`Uploading contract for project: ${id}`);

    await this.findOne(id, user);

    // 1. Upload document using centralized DocumentService
    const document = await this.documentService.uploadDocument(
      user,
      {
        buffer: file.buffer,
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
      },
      FolderType.ORGANIZATION_DOCUMENT,
    );

    // 2. Link to Project Contract
    const fileUrl = `https://${document.bucket}.s3.amazonaws.com/${document.object_key}`;

    return this.projectRepository.addContract({
      project_id: id,
      file_name: file.originalname,
      file_url: fileUrl,
      file_type: file.mimetype,
      uploaded_by: user.userId,
    });
  }

  async getTeam(id: string, user: LoggedInUser) {
    this.logger.log(`Fetching team for project: ${id}`);
    await this.findOne(id, user);
    return this.projectRepository.getTeam(id);
  }

  async getContracts(id: string, user: LoggedInUser) {
    this.logger.log(`Fetching contracts for project: ${id}`);
    await this.findOne(id, user);
    return this.projectRepository.getContracts(id);
  }

  async removeTeamMember(id: string, userId: string, user: LoggedInUser) {
    this.logger.log(`Removing member: ${userId} from project: ${id}`);
    await this.findOne(id, user);
    await this.projectRepository.removeTeamMember(id, userId);
  }
}
