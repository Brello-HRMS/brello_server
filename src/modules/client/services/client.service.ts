import {
  Injectable,
  NotFoundException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { ClientRepository } from '../repositories/client.repository';
import { SearchIndexingService } from '../../global-search/services/search-indexing.service';
import { CreateClientDto } from '../dto/create-client.dto';
import { UpdateClientDto } from '../dto/update-client.dto';
import { ListClientsDto } from '../dto/list-clients.dto';
import { Client } from '../entities/client.entity';
import { ListingHelper } from '../../../common/utils/listing.helper';
import { LoggedInUser } from '../../auth/interfaces/logged-in-user.interface';
import { PaginatedResponse } from '../../../common/dto/pagination.dto';
import { AuditContextService } from '../../audit/services/audit-context.service';

@Injectable()
export class ClientService {
  private readonly logger = new Logger(ClientService.name);

  constructor(
    private readonly clientRepository: ClientRepository,
    private readonly searchIndexingService: SearchIndexingService,
    private readonly auditContext: AuditContextService,
  ) {}

  async create(dto: CreateClientDto, user: LoggedInUser): Promise<Client> {
    this.logger.log(`Creating client: ${dto.name}`);

    const existingClient = await this.clientRepository.findOne({
      where: {
        name: dto.name,
        organization_id: user.organizationId,
        enterprise_id: user.enterpriseId,
      },
    });

    if (existingClient) {
      throw new BadRequestException(
        `Client with name "${dto.name}" already exists in this organization`,
      );
    }

    const clientData = {
      ...dto,
      organization_id: user.organizationId,
      enterprise_id: user.enterpriseId,
      created_by: user.userId,
    };

    const client = await this.clientRepository.create(clientData as any);
    this.searchIndexingService.indexClient(client, user.enterpriseId, user.organizationId);
    return client;
  }

  async findAll(
    query: ListClientsDto,
    user: LoggedInUser,
  ): Promise<PaginatedResponse<Client>> {
    this.logger.log('Fetching all clients with filters');

    const queryBuilder = this.clientRepository
      .getQueryBuilder('client')
      .loadRelationCountAndMap('client.projects_count', 'client.projects');

    return ListingHelper.apply(queryBuilder, query, user, {
      searchFields: ['name', 'poc_name', 'poc_email'],
      filterFields: ['status'],
      alias: 'client',
    });
  }

  async findOne(id: string): Promise<Client> {
    this.logger.log(`Fetching client: ${id}`);

    const client = await this.clientRepository.findById(id);

    if (!client) {
      throw new NotFoundException(`Client with ID "${id}" not found`);
    }

    if (client.projects) {
      client.projects_count = client.projects.length;
    }

    return client;
  }

  async update(
    id: string,
    dto: UpdateClientDto,
    user: LoggedInUser,
  ): Promise<Client> {
    this.logger.log(`Updating client: ${id}`);

    const existing = await this.findOne(id);
    this.auditContext.setPreValue(existing as unknown as Record<string, unknown>);

    const updatedClient = await this.clientRepository.update(id, {
      ...dto,
      modified_by: user.userId,
      modified_at: new Date(),
    } as any);

    if (!updatedClient) {
      throw new NotFoundException(
        `Client with ID "${id}" not found after update`,
      );
    }

    this.searchIndexingService.indexClient(updatedClient, user.enterpriseId, user.organizationId);
    return updatedClient;
  }

  async remove(id: string): Promise<void> {
    this.logger.log(`Deleting client: ${id}`);

    const client = await this.findOne(id);
    this.auditContext.setPreValue(client as unknown as Record<string, unknown>);

    const success = await this.clientRepository.delete(id);

    if (!success) {
      throw new NotFoundException(`Failed to delete client with ID "${id}"`);
    }

    this.searchIndexingService.removeClient(id, client.enterprise_id);
  }
}
