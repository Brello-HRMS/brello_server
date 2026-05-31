import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';

import { Lead } from '../entities/lead.entity';
import { LeadStatus } from '../enums/lead-status.enum';
import { LeadSource } from '../enums/lead-source.enum';

@Injectable()
export class LeadRepository {
  constructor(
    @InjectRepository(Lead)
    private readonly repository: Repository<Lead>,
  ) {}

  async findAll(filters?: { status?: LeadStatus; source?: LeadSource }): Promise<Lead[]> {
    const where: FindOptionsWhere<Lead> = {};
    if (filters?.status) where.lead_status = filters.status;
    if (filters?.source) where.source = filters.source;
    return this.repository.find({ where, order: { created_at: 'DESC' } });
  }

  async create(data: Partial<Lead>): Promise<Lead> {
    const lead = this.repository.create(data);
    return this.repository.save(lead);
  }

  async findByEmail(email: string): Promise<Lead | null> {
    return this.repository.findOne({ where: { email } });
  }

  async findById(id: string): Promise<Lead | null> {
    return this.repository.findOne({ where: { id } });
  }

  async update(id: string, data: Partial<Lead>): Promise<Lead | null> {
    await this.repository.update(id, data);
    return this.findById(id);
  }
}
