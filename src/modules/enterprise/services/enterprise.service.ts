import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import * as dns from 'dns/promises';
import { EnterpriseRepository } from '../repositories/enterprise.repository';
import { CreateEnterpriseDto } from '../dto/create-enterprise.dto';
import { UpdateEnterpriseDto } from '../dto/update-enterprise.dto';
import { Enterprise } from '../entities/enterprise.entity';

@Injectable()
export class EnterpriseService {
  private readonly logger = new Logger(EnterpriseService.name);

  constructor(private readonly enterpriseRepository: EnterpriseRepository) {}

  private async verifyDomainExists(domain: string): Promise<void> {
    try {
      await dns.lookup(domain);
    } catch (error) {
      throw new BadRequestException(
        `Domain '${domain}' does not exist or is unreachable`,
      );
    }
  }

  async create(createEnterpriseDto: CreateEnterpriseDto): Promise<Enterprise> {
    this.logger.log(`Creating enterprise: ${createEnterpriseDto.name}`);

    const existingEnterprise = await this.enterpriseRepository.findByDomain(
      createEnterpriseDto.domain,
    );

    if (existingEnterprise) {
      throw new ConflictException(
        `Enterprise with domain '${createEnterpriseDto.domain}' already exists`,
      );
    }

    await this.verifyDomainExists(createEnterpriseDto.domain);

    const enterprise =
      await this.enterpriseRepository.create(createEnterpriseDto);

    this.logger.log(`Enterprise created successfully: ${enterprise.id}`);
    return enterprise;
  }

  async findAll(): Promise<Enterprise[]> {
    this.logger.log('Fetching all enterprises');
    return this.enterpriseRepository.findAll();
  }

  async findOne(id: string): Promise<Enterprise> {
    this.logger.log(`Fetching enterprise: ${id}`);

    const enterprise = await this.enterpriseRepository.findById(id);

    if (!enterprise) {
      throw new NotFoundException(`Enterprise with ID '${id}' not found`);
    }

    return enterprise;
  }

  async update(
    id: string,
    updateEnterpriseDto: UpdateEnterpriseDto,
  ): Promise<Enterprise> {
    this.logger.log(`Updating enterprise: ${id}`);

    await this.findOne(id);

    if (updateEnterpriseDto.domain) {
      const existingEnterprise = await this.enterpriseRepository.findByDomain(
        updateEnterpriseDto.domain,
      );

      if (existingEnterprise && existingEnterprise.id !== id) {
        throw new ConflictException(
          `Enterprise with domain '${updateEnterpriseDto.domain}' already exists`,
        );
      }

      await this.verifyDomainExists(updateEnterpriseDto.domain);
    }

    const updatedEnterprise = await this.enterpriseRepository.update(
      id,
      updateEnterpriseDto,
    );

    if (!updatedEnterprise) {
      throw new NotFoundException(
        `Enterprise with ID '${id}' not found after update`,
      );
    }

    this.logger.log(`Enterprise updated successfully: ${id}`);
    return updatedEnterprise;
  }

  async remove(id: string): Promise<void> {
    this.logger.log(`Deleting enterprise: ${id}`);

    await this.findOne(id);

    const deleted = await this.enterpriseRepository.delete(id);

    if (!deleted) {
      throw new NotFoundException(
        `Failed to delete enterprise with ID '${id}'`,
      );
    }

    this.logger.log(`Enterprise deleted successfully: ${id}`);
  }
}
